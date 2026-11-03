/** Port of upstream `utils/error.ts`, minus the billing and credit errors. */
export type HandlerErrorCode =
	'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'SERVICE_UNAVAILABLE';

/**
 * A general error class for domain errors thrown by services. The global exception filter maps it
 * to a GraphQL error (`extensions.code`) or an HTTP status.
 */
export class HandlerError extends Error {
	readonly codeMessage: HandlerErrorCode;
	readonly code: number;

	constructor(codeMessage: HandlerErrorCode, message: string) {
		super(message);
		this.name = 'HandlerError';
		this.codeMessage = codeMessage;
		this.code = httpStatusByHandlerErrorCode[codeMessage] ?? 500;
	}
}

export class BudgetExceededError extends HandlerError {
	constructor(message: string) {
		super('FORBIDDEN', message);
		this.name = 'BudgetExceededError';
	}
}

export const httpStatusByHandlerErrorCode: Record<HandlerErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	SERVICE_UNAVAILABLE: 503,
};
