import { authClient } from '@/lib/auth-client';

type Session = NonNullable<Awaited<ReturnType<typeof authClient.getSession>>['data']>;

let inFlight: Promise<Session | null> | null = null;

async function loadSession(): Promise<Session | null> {
	const { data, error } = await authClient.getSession();
	if (error) {
		throw new Error(error.message ?? 'Could not load the session');
	}
	return data ?? null;
}

/** Guards run on every navigation, so they share one promise. A failure is never cached. */
export function fetchSession() {
	inFlight ??= loadSession().catch((error: unknown) => {
		inFlight = null;
		throw error;
	});
	return inFlight;
}

/** Call after every sign-in and sign-out, before navigating. */
export function invalidateSession() {
	inFlight = null;
}
