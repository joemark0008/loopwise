import { AsyncLocalStorage } from 'node:async_hooks';

import type { NextFunction, Request, Response } from 'express';

import { uuidv7 } from './uuid.js';

/** The header a caller (proxy, frontend) may send to correlate its logs with ours; we echo it on every response. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** What the app knows about the request it is serving: the audit trail and the logs read it. */
export interface RequestContext {
	/** The caller's `x-request-id` when it is a sane token, else a fresh UUIDv7. */
	readonly requestId: string;
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
	/** The signed-in user, set by the `AuthGuard` once the session is read. */
	userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Accepted inbound ids: short, printable tokens only (they end up in logs and the audit trail). */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** The context of the request being served, or `undefined` outside one (jobs, seeds, boot). */
export function currentRequestContext(): RequestContext | undefined {
	return storage.getStore();
}

/** The correlation id of the request being served, if any. */
export function currentRequestId(): string | undefined {
	return storage.getStore()?.requestId;
}

/**
 * Runs `fn` inside `context`: for work that is not an HTTP request but should be traceable the same way (a pg-boss
 * job, a test). Nested calls replace the outer context for the duration of `fn`.
 */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
	return storage.run(context, fn);
}

type RequestWithContext = Request & { requestContext?: RequestContext };

/** The context attached to `req` by `requestContextMiddleware` (also reachable where async context was lost). */
export function getRequestContext(req: Request): RequestContext | undefined {
	return (req as RequestWithContext).requestContext;
}

function headerValue(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

function createContext(req: Request): RequestContext {
	const inbound = headerValue(req.headers[REQUEST_ID_HEADER])?.trim();
	return {
		requestId: inbound && REQUEST_ID_PATTERN.test(inbound) ? inbound : uuidv7(),
		ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
		userAgent: headerValue(req.headers['user-agent']) ?? null,
	};
}

/**
 * Express middleware: gives the request its context (once), echoes `x-request-id` on the response and runs the rest of
 * the chain inside the context, for REST and GraphQL alike. `configureApp` registers it first and again after the body
 * parsers: stream-based parsing resumes in the socket's async context, so the second pass re-enters the same context.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
	const holder = req as RequestWithContext;
	let context = holder.requestContext;
	if (!context) {
		context = createContext(req);
		holder.requestContext = context;
		res.setHeader(REQUEST_ID_HEADER, context.requestId);
	}
	storage.run(context, next);
}
