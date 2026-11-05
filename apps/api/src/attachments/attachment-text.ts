import { scopedKey, type StorageScope } from './storage/index.js';
import { readUserFile, statUserFile } from './storage/user-files.js';

/** Extracted texts kept in memory, so reading a long scan in parts runs OCR once rather than once per part. */
const MAX_CACHED_FILES = 10;

interface CachedText {
	/** Size and modification time of the file the text came from: a file replaced since is read again. */
	version: string;
	text: string;
}

const cache = new Map<string, CachedText>();

/**
 * The readable text of a file in the user's own storage space (`readUserFile`: PDF text layer or OCR, .docx, text
 * formats, an .xlsx outline). The scope comes from the caller's session, never from the model, and the path is
 * sanitized against it, so another user's or project's files are out of reach.
 * @throws Error when the file is missing or has no text to offer.
 */
export const readAttachmentText = async (scope: StorageScope, relativePath: string): Promise<string> => {
	const key = scopedKey(scope, relativePath);
	const stored = await statUserFile(scope, relativePath);
	if (!stored) {
		throw new Error(`No such file in your attachments: ${relativePath}`);
	}

	const version = `${stored.size}:${stored.lastModified.getTime()}`;
	const cached = cache.get(key);
	if (cached?.version === version) {
		// Re-inserting keeps the map in least-recently-used order.
		cache.delete(key);
		cache.set(key, cached);
		return cached.text;
	}

	const text = await readUserFile(scope, relativePath);
	cache.set(key, { version, text });
	while (cache.size > MAX_CACHED_FILES) {
		cache.delete(cache.keys().next().value!);
	}
	return text;
};

export const __clearAttachmentTextCacheForTesting = (): void => {
	cache.clear();
};
