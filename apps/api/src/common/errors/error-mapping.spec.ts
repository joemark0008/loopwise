import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
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
});
