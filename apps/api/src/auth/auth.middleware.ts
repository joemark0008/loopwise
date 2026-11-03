import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';

import { AuthService } from './auth.service.js';

const AUTH_BASE_PATH = '/api/auth';

/**
 * Serves `/api/auth/*` with better-auth (port of upstream `routes/auth.ts`), plus the
 * `/api/auth/error` redirect to the login page (`routes/auth-error-redirect.ts`).
 * Registered before the body parsers: better-auth reads the raw request body itself.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
	private readonly logger = new Logger(AuthMiddleware.name);

	constructor(private readonly auth: AuthService) {}

	async use(req: Request, res: Response, next: NextFunction) {
		const path = req.originalUrl.split('?')[0];
		if (path !== AUTH_BASE_PATH && !path.startsWith(`${AUTH_BASE_PATH}/`)) {
			return next();
		}

		if (req.method === 'GET' && path === `${AUTH_BASE_PATH}/error`) {
			const qs = new URL(req.originalUrl, 'http://localhost').searchParams.toString();
			return res.redirect(302, qs ? `/login?${qs}` : '/login');
		}

		try {
			// better-auth matches on the full path: undo Express' mount-path stripping.
			req.url = req.originalUrl;
			const handler = toNodeHandler(await this.auth.getAuth());
			await handler(req, res);
		} catch (error) {
			this.logger.error('Authentication error', error instanceof Error ? error.stack : String(error));
			if (!res.headersSent) {
				res.status(500).json({ error: 'Internal authentication error', code: 'AUTH_FAILURE' });
			}
		}
	}
}
