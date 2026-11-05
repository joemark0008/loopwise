import type { StorageScope } from './types.js';

/** S3 caps object keys at 1024 bytes; the same budget keeps local paths sane. */
const MAX_KEY_LENGTH = 1024;

/**
 * Builds the full storage key for a path inside a scope.
 * @throws Error when the scope or path is unsafe.
 */
export const scopedKey = (scope: StorageScope, relativePath: string): string => {
	const key = `${scopeRoot(scope)}/${sanitizeRelativePath(relativePath)}`;

	if (Buffer.byteLength(key) > MAX_KEY_LENGTH) {
		throw new Error(`Path is too long: keys may not exceed ${MAX_KEY_LENGTH} bytes`);
	}

	return key;
};

/**
 * The prefix holding every file for one user in one clinic. Keys keep the `projects/` prefix they were stored under
 * before clinics were called clinics, so existing files stay where they are.
 */
export const scopeRoot = (scope: StorageScope): string => {
	return `projects/${safeIdentifier(scope.clinicId, 'clinic id')}/users/${safeIdentifier(scope.userId, 'user id')}`;
};

/** The prefix holding every file of a clinic, whoever it belongs to. */
export const clinicRoot = (clinicId: string): string => {
	return `projects/${safeIdentifier(clinicId, 'clinic id')}`;
};

/** The owner of a key, or null when the key sits outside a user space. */
export const userIdFromKey = (key: string): string | null => {
	const [clinics, , users, userId, ...rest] = key.split('/');

	if (clinics !== 'projects' || users !== 'users' || !userId || rest.length === 0) {
		return null;
	}

	return userId;
};

/** Converts a full storage key back to the path the caller passed in. */
export const relativePathFromKey = (scope: StorageScope, key: string): string => {
	const root = `${scopeRoot(scope)}/`;
	if (!key.startsWith(root)) {
		throw new Error('Key does not belong to this scope');
	}
	return key.slice(root.length);
};

/**
 * Normalises a caller-supplied path into a relative key. Traversal, absolute
 * paths, control characters and Windows separators are rejected rather than
 * silently rewritten, so an unsafe path never resolves to a valid key.
 */
export const sanitizeRelativePath = (relativePath: string): string => {
	if (typeof relativePath !== 'string' || relativePath.trim() === '') {
		throw new Error('Path is required');
	}

	if (relativePath.includes('\0')) {
		throw new Error('Path may not contain null bytes');
	}

	if (relativePath.includes('\\')) {
		throw new Error('Path may not contain backslashes: use / as the separator');
	}

	// eslint-disable-next-line no-control-regex
	if (/[\x00-\x1f\x7f]/.test(relativePath)) {
		throw new Error('Path may not contain control characters');
	}

	const segments = relativePath.split('/').filter((segment) => segment !== '');

	if (segments.length === 0) {
		throw new Error('Path is required');
	}

	for (const segment of segments) {
		if (segment === '.' || segment === '..') {
			throw new Error(`Path may not contain '${segment}' segments`);
		}
		if (segment.trim() === '') {
			throw new Error('Path may not contain blank segments');
		}
	}

	return segments.join('/');
};

const safeIdentifier = (value: string, label: string): string => {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new Error(`Missing ${label}`);
	}
	if (!/^[A-Za-z0-9_-]+$/.test(value)) {
		throw new Error(`Invalid ${label}`);
	}
	return value;
};
