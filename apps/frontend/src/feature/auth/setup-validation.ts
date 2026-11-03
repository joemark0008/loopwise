/** Checks shown while filling in `/setup`, so a mistake surfaces on its field. The API stays the authority. */
export function validateSetupName(value: string): string | undefined {
	return value.trim() ? undefined : 'Enter your name.';
}

export function validateSetupEmail(value: string): string | undefined {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? undefined : 'Enter a valid email address.';
}

export function validateSetupPassword(value: string): string | undefined {
	if (value.length < 8) {
		return 'Use at least 8 characters.';
	}
	return value.length > 128 ? 'Use at most 128 characters.' : undefined;
}
