import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { GqlContextType } from '@nestjs/graphql';
import type { Response } from 'express';
import { GraphQLError } from 'graphql';

import { mapError } from './error-mapping.js';

/**
 * Global exception filter: maps domain errors (`HandlerError`), Nest HTTP exceptions and known
 * Prisma errors to GraphQL errors (`extensions.code`) or HTTP status codes. Anything else is
 * logged and reported as an internal error without leaking its message.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const mapped = mapError(exception);
		if (mapped.internal) {
			this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
		}

		if (host.getType<GqlContextType>() === 'graphql') {
			return new GraphQLError(mapped.message, {
				extensions: { code: mapped.code, http: { status: mapped.status } },
			});
		}

		const response = host.switchToHttp().getResponse<Response>();
		if (response.headersSent) {
			return;
		}
		response.status(mapped.status).json({ error: mapped.message, code: mapped.code });
	}
}
