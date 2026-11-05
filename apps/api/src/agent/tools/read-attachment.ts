import { readAttachment } from '@loopwise/shared/tools';

import { createTool, isStoragePath, toStorageRelativePath } from '../utils/tools.js';

/**
 * Reads a file the user attached to a message (DESIGN.md §9.2), from their own storage space only: the space is the
 * run's user and clinic, never something the model chose, and the path is sanitized against it. Scanned PDF pages
 * are read by OCR. Reads only.
 */
export default createTool<readAttachment.Input, readAttachment.Output>({
	kind: 'read',
	description: readAttachment.description,
	inputSchema: readAttachment.InputSchema,
	outputSchema: readAttachment.OutputSchema,
	execute: async ({ path, offset = 0 }, context) => {
		if (!isStoragePath(path)) {
			throw new Error(
				`${path} is not an attachment path. Use the /home/... path the user's message gives for the file.`,
			);
		}
		const relativePath = toStorageRelativePath(path);
		if (!relativePath) {
			throw new Error('Give the path of one attached file, not the storage folder.');
		}

		const text = await context.services.attachments.readTextForWise(context.userId, context.clinicId, relativePath);
		const start = Math.min(offset, text.length);
		const end = Math.min(start + readAttachment.MAX_CHARS, text.length);
		const truncated = end < text.length;

		return {
			_version: '1' as const,
			path,
			fileName: relativePath.slice(relativePath.lastIndexOf('/') + 1),
			content: truncated
				? `${text.slice(start, end)}\n\n[… truncated: characters ${start}–${end} of ${text.length} shown. Call read_attachment again with offset ${end} to read on.]`
				: text.slice(start),
			totalChars: text.length,
			...(truncated && { nextOffset: end }),
		};
	},
});
