/** Classifies API errors by the GraphQL error code `lib/apollo-procedures.ts` puts in `data.code`. */
const RETRYABLE_API_ERROR_CODES = new Set([
	'INTERNAL_SERVER_ERROR',
	'BAD_GATEWAY',
	'SERVICE_UNAVAILABLE',
	'GATEWAY_TIMEOUT',
	'TIMEOUT',
]);

interface ChatErrorState {
	error: unknown;
	isError: boolean;
	isLoadingError: boolean;
}

export function isRetryableApiError(error: unknown): boolean {
	const code = getApiErrorCode(error);
	return code === undefined || RETRYABLE_API_ERROR_CODES.has(code);
}

export function isDefinitiveChatError(error: unknown): boolean {
	const code = getApiErrorCode(error);
	return code === 'NOT_FOUND' || code === 'UNAUTHORIZED' || code === 'FORBIDDEN';
}

export function shouldShowChatAccessError(state: ChatErrorState): boolean {
	return state.isLoadingError || (state.isError && isDefinitiveChatError(state.error));
}

export function isForbiddenError(error: unknown): boolean {
	return getApiErrorCode(error) === 'FORBIDDEN';
}

export function isNotFoundError(error: unknown): boolean {
	return getApiErrorCode(error) === 'NOT_FOUND';
}

export function isUnauthorizedError(error: unknown): boolean {
	return getApiErrorCode(error) === 'UNAUTHORIZED';
}

export function isInternalServerError(error: unknown): boolean {
	return getApiErrorCode(error) === 'INTERNAL_SERVER_ERROR';
}

export function getApiErrorCode(error: unknown): string | undefined {
	if (typeof error !== 'object' || error === null || !('data' in error)) {
		return undefined;
	}
	const { data } = error as { data?: { code?: string } | null };
	return data?.code ?? undefined;
}
