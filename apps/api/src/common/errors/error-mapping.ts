import { HttpException, HttpStatus } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { DomainError, type DomainErrorDetails } from './domain-error.js';
import { HandlerError, type HandlerErrorCode } from './handler-error.js';

export type ErrorCode = HandlerErrorCode | 'INTERNAL_SERVER_ERROR' | 'TOO_MANY_REQUESTS' | 'PAYLOAD_TOO_LARGE';

export interface MappedError {
	/** The generic class (`extensions.code`; the frontend branches on it). */
	code: ErrorCode;
	status: number;
	message: string;
	/** Whether the original error is unexpected and must be logged. */
	internal: boolean;
	/** The stable specific code of a `DomainError` or a recognised database rule (`extensions.errorCode`). */
	errorCode?: string;
	details?: DomainErrorDetails;
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
	if (exception instanceof DomainError) {
		return {
			code: exception.kind,
			status: exception.code,
			message: exception.message,
			internal: false,
			errorCode: exception.errorCode,
			...(exception.details ? { details: exception.details } : {}),
		};
	}

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
		const mapped = mapPrismaError(exception);
		if (mapped) {
			return mapped;
		}
	}

	return { code: 'INTERNAL_SERVER_ERROR', status: 500, message: INTERNAL_MESSAGE, internal: true };
}

function mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): MappedError | null {
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

	// What the database itself refused (driver adapter errors carry the Postgres SQLSTATE).
	const { sqlState, message } = postgresError(exception);
	switch (sqlState) {
		case '42501': // insufficient_privilege: row-level security (no care relationship, not this clinic)
			return {
				code: 'FORBIDDEN',
				status: 403,
				message: 'You do not have access to this record.',
				internal: false,
				errorCode: 'ROW_SECURITY_DENIED',
			};
		case '23514': // check_violation: a CHECK constraint, an issued-document lock or a status machine trigger
			return {
				code: 'CONFLICT',
				status: 409,
				message: message ?? 'The change breaks a data rule.',
				internal: false,
				errorCode: 'CHECK_VIOLATION',
			};
		case '23503': // foreign_key_violation: a reference to a row that doesn't exist (e.g. an unknown ICD-10 code)
			return {
				code: 'BAD_REQUEST',
				status: 400,
				message: 'A referenced record does not exist.',
				internal: false,
				errorCode: 'FOREIGN_KEY_VIOLATION',
			};
		case '22P02': // invalid_text_representation: e.g. a non-UUID id
			return {
				code: 'BAD_REQUEST',
				status: 400,
				message: 'Invalid identifier.',
				internal: false,
				errorCode: 'INVALID_ID',
			};
		default:
			return null;
	}
}

/** The SQLSTATE and message of a Postgres error behind a Prisma driver adapter error, when there is one. */
export function postgresError(exception: Prisma.PrismaClientKnownRequestError): {
	sqlState?: string;
	message?: string;
} {
	const cause = (exception.meta?.driverAdapterError as { cause?: Record<string, unknown> } | undefined)?.cause;
	const sqlState = cause?.originalCode ?? cause?.code;
	const message = cause?.originalMessage ?? cause?.message;
	return {
		sqlState: typeof sqlState === 'string' ? sqlState : undefined,
		message: typeof message === 'string' ? message : undefined,
	};
}
