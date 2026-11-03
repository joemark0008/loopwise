import { HttpException, HttpStatus } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { HandlerError, type HandlerErrorCode } from './handler-error.js';

export type ErrorCode = HandlerErrorCode | 'INTERNAL_SERVER_ERROR' | 'TOO_MANY_REQUESTS' | 'PAYLOAD_TOO_LARGE';

export interface MappedError {
	code: ErrorCode;
	status: number;
	message: string;
	/** Whether the original error is unexpected and must be logged. */
	internal: boolean;
}

const codeByStatus: Record<number, ErrorCode> = {
	[HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
	[HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
	[HttpStatus.FORBIDDEN]: 'FORBIDDEN',
	[HttpStatus.NOT_FOUND]: 'NOT_FOUND',
	[HttpStatus.CONFLICT]: 'CONFLICT',
	[HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
	[HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
	[HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

const INTERNAL_MESSAGE = 'Internal server error';

/** Maps any thrown value to the code, HTTP status and client-safe message sent by REST and GraphQL. */
export function mapError(exception: unknown): MappedError {
	if (exception instanceof HandlerError) {
		return { code: exception.codeMessage, status: exception.code, message: exception.message, internal: false };
	}

	if (exception instanceof HttpException) {
		const status = exception.getStatus();
		const response = exception.getResponse();
		const message =
			typeof response === 'object' && response !== null && 'message' in response
				? [response.message].flat().join(', ')
				: exception.message;
		return {
			code: codeByStatus[status] ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
			status,
			message,
			internal: status >= 500,
		};
	}

	if (exception instanceof Prisma.PrismaClientKnownRequestError) {
		if (exception.code === 'P2002') {
			return {
				code: 'CONFLICT',
				status: 409,
				message: 'A record with these values already exists.',
				internal: false,
			};
		}
		if (exception.code === 'P2025') {
			return { code: 'NOT_FOUND', status: 404, message: 'Record not found.', internal: false };
		}
	}

	return { code: 'INTERNAL_SERVER_ERROR', status: 500, message: INTERNAL_MESSAGE, internal: true };
}
