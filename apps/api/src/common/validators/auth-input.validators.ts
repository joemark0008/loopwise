import { registerDecorator } from 'class-validator';
import { z } from 'zod/v4';

/** Trims string inputs before validation. */
export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Trims and lower-cases emails, as they are stored. */
export const normalizeEmail = ({ value }: { value: unknown }) =>
	typeof value === 'string' ? value.trim().toLowerCase() : value;

/** better-auth's own password bounds: anything outside them could never be used to sign in. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * better-auth validates the sign-in email with `z.email()`, which is stricter than class-validator's `@IsEmail`
 * (it rejects `é@x.com`). Accounts must refuse anything sign-in would refuse, or they could not log in.
 */
export function IsSignInEmail() {
	return (target: object, propertyKey: string) =>
		registerDecorator({
			name: 'isSignInEmail',
			target: target.constructor,
			propertyName: propertyKey,
			validator: {
				validate: (value: unknown) => z.email().safeParse(value).success,
				defaultMessage: () => 'email must be an email',
			},
		});
}
