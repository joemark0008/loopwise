import type { PasswordLinkQuery } from '@/graphql/generated/graphql';
import { PasswordLinkDocument, SetPasswordWithLinkDocument } from '@/graphql/generated/graphql';
import { getApiErrorCode } from '@/lib/api-error';
import { runMutation, runQuery } from '@/lib/apollo-procedures';

export type PasswordLinkInfo = NonNullable<PasswordLinkQuery['passwordLink']>;

export type SetPasswordResult =
	{ status: 'ok'; email: string } | { status: 'invalid-link' } | { status: 'error'; message: string };

/** Who a set-password link is for, or null when it is invalid, used or expired. */
export async function getPasswordLink(token: string): Promise<PasswordLinkInfo | null> {
	return (await runQuery(PasswordLinkDocument, { token })).passwordLink ?? null;
}

export async function setPasswordWithLink(token: string, password: string): Promise<SetPasswordResult> {
	try {
		const { setPasswordWithLink: email } = await runMutation(SetPasswordWithLinkDocument, {
			input: { token, password },
		});
		return { status: 'ok', email };
	} catch (error) {
		if (getApiErrorCode(error) === 'NOT_FOUND') {
			return { status: 'invalid-link' };
		}
		return { status: 'error', message: error instanceof Error ? error.message : 'Could not set the password.' };
	}
}
