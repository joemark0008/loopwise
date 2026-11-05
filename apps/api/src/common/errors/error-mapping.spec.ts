import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import { EntityNotFoundError, InvalidStatusTransitionError } from './domain-error.js';
import { mapError } from './error-mapping.js';
import { HandlerError } from './handler-error.js';

describe('mapError', () => {
	it('maps domain errors to their code and status', () => {
		expect(mapError(new HandlerError('NOT_FOUND', 'Chat not found.'))).toEqual({
			code: 'NOT_FOUND',
			status: 404,
			message: 'Chat not found.',
			internal: false,
		});
	});

	it('maps Nest HTTP exceptions', () => {
		expect(mapError(new UnauthorizedException())).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
		expect(mapError(new ForbiddenException('Only admins'))).toMatchObject({
			code: 'FORBIDDEN',
			status: 403,
			message: 'Only admins',
		});
	});

	it('maps Prisma unique violations to CONFLICT', () => {
		const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
			code: 'P2002',
			clientVersion: 'test',
		});
		expect(mapError(error)).toMatchObject({ code: 'CONFLICT', status: 409 });
	});

	it('hides the message of unexpected errors', () => {
		expect(mapError(new Error('connection string with password'))).toEqual({
			code: 'INTERNAL_SERVER_ERROR',
			status: 500,
			message: 'Internal server error',
			internal: true,
		});
	});

	it('maps a DomainError to its class, status, stable code and details', () => {
		expect(mapError(new InvalidStatusTransitionError('DiagnosticOrder', 'RELEASED', 'CANCELLED'))).toEqual({
			code: 'CONFLICT',
			status: 409,
			message: 'Diagnostic order cannot go from RELEASED to CANCELLED.',
			internal: false,
			errorCode: 'INVALID_STATUS_TRANSITION',
			details: { entityType: 'DiagnosticOrder', from: 'RELEASED', to: 'CANCELLED' },
		});
		const notFound = new EntityNotFoundError('Patient', 'p-1');
		expect(notFound).toBeInstanceOf(HandlerError);
		expect(notFound.name).toBe('EntityNotFoundError');
		expect(mapError(notFound)).toMatchObject({ code: 'NOT_FOUND', status: 404, errorCode: 'ENTITY_NOT_FOUND' });
	});

	it('maps Postgres row-level security and check violations behind the driver adapter', () => {
		const pgError = (originalCode: string, originalMessage: string) =>
			new Prisma.PrismaClientKnownRequestError('Database error', {
				code: 'P2039',
				clientVersion: 'test',
				meta: { driverAdapterError: { cause: { kind: 'postgres', originalCode, originalMessage } } },
			});
		expect(mapError(pgError('42501', 'new row violates row-level security policy'))).toMatchObject({
			code: 'FORBIDDEN',
			status: 403,
			errorCode: 'ROW_SECURITY_DENIED',
		});
		expect(mapError(pgError('23514', 'prescriptions x is issued, it can only be voided'))).toMatchObject({
			code: 'CONFLICT',
			message: 'prescriptions x is issued, it can only be voided',
			errorCode: 'CHECK_VIOLATION',
		});
		expect(mapError(pgError('P0001', 'audit_logs is append-only'))).toMatchObject({ internal: true });
	});
});
