import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { GqlContextType } from '@nestjs/graphql';
import type { Response } from 'express';
import { GraphQLError } from 'graphql';

import { currentRequestId } from '../request-context.js';
import { mapError } from './error-mapping.js';

/**
 * Global exception filter: maps domain errors (`DomainError`, `HandlerError`), Nest HTTP exceptions and known
 * Prisma / Postgres errors to GraphQL errors (`extensions.code`, plus `extensions.errorCode` and `details` for a
 * `DomainError`) or HTTP status codes. Anything else is logged and reported as an internal error without leaking its
 * message. Both carry the request id, so a user's report can be matched to the logs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const mapped = mapError(exception);
		const requestId = currentRequestId();
		const specific = {
			...(mapped.errorCode ? { errorCode: mapped.errorCode } : {}),
			...(mapped.details ? { details: mapped.details } : {}),
			...(requestId ? { requestId } : {}),
		};
		if (mapped.internal) {
			this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
		}

		if (host.getType<GqlContextType>() === 'graphql') {
			return new GraphQLError(mapped.message, {
				extensions: { code: mapped.code, ...specific, http: { status: mapped.status } },
			});
		}

		const response = host.switchToHttp().getResponse<Response>();
		if (response.headersSent) {
			return;
		}
		response.status(mapped.status).json({ error: mapped.message, code: mapped.code, ...specific });
	}
}
