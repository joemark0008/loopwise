import { CompleteSetupDocument, HasUsersDocument } from '@/graphql/generated/graphql';
import { getApiErrorCode } from '@/lib/api-error';
import { apolloClient } from '@/lib/apollo-client';
import { runMutation } from '@/lib/apollo-procedures';

export type CompleteSetupResult =
	| { status: 'ok' }
	| { status: 'invalid-token' }
	| { status: 'already-complete' }
	| { status: 'error'; message: string };

let setupComplete = false;

/**
 * Whether the install wizard has been completed (the instance has users). Only `true` is cached, since setup
 * can still finish while `false`. A failed request counts as set up, so an API outage does not trap everyone
 * on /setup, and is not cached.
 */
export async function isSetupComplete(): Promise<boolean> {
	if (setupComplete) {
		return true;
	}
	try {
		const { data } = await apolloClient.query({ query: HasUsersDocument, fetchPolicy: 'network-only' });
		setupComplete = data?.hasUsers === true;
		return setupComplete;
	} catch {
		return true;
	}
}

export function markSetupComplete(): void {
	setupComplete = true;
}

export async function completeSetup(input: {
	token: string;
	name: string;
	email: string;
	password: string;
}): Promise<CompleteSetupResult> {
	try {
		await runMutation(CompleteSetupDocument, { input });
		return { status: 'ok' };
	} catch (error) {
		const code = getApiErrorCode(error);
		if (code === 'FORBIDDEN') {
			return { status: 'invalid-token' };
		}
		if (code === 'CONFLICT') {
			return { status: 'already-complete' };
		}
		return { status: 'error', message: error instanceof Error ? error.message : 'Setup failed.' };
	}
}
