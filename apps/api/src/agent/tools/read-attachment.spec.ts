import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { readAttachment as readAttachmentDefinition } from '@loopwise/shared/tools';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __clearAttachmentTextCacheForTesting } from '../../attachments/attachment-text.js';
import { AttachmentsService } from '../../attachments/attachments.service.js';
import { terminateOcr } from '../../attachments/ocr.js';
import { __reloadEnvForTesting, __resetStorageForTesting } from '../../attachments/storage/index.js';
import * as userFiles from '../../attachments/storage/user-files.js';
import { buildPdf, scannedLabResult } from '../../attachments/testing/pdf-fixture.spec-helper.js';
import { readOnlyToolServices } from '../services/tool-services.js';
import type { ToolContext } from '../types/tools.js';
import readAttachment from './read-attachment.js';

const me = { projectId: 'proj-1', userId: 'user-1' };
const someoneElse = { projectId: 'proj-1', userId: 'user-2' };

/** The real service behind the read-only facade the tool gets, as `AgentService.buildToolContext` wires it. */
const attachments = readOnlyToolServices({
	attachments: new AttachmentsService({} as never),
} as never).attachments;

const read = (input: readAttachmentDefinition.Input, scope = me) => {
	const context = { ...scope, services: { attachments } } as unknown as ToolContext;
	return readAttachment.execute!(input, {
		experimental_context: context,
		toolCallId: 't',
		messages: [],
	}) as Promise<readAttachmentDefinition.Output>;
};

let root: string;
let originalEnv: typeof process.env;

beforeEach(async () => {
	originalEnv = { ...process.env };
	root = await fs.mkdtemp(path.join(os.tmpdir(), 'loopwise-read-attachment-test-'));
	process.env.LOOPWISE_STORAGE_BACKEND = 'local';
	process.env.LOOPWISE_STORAGE_LOCAL_PATH = root;
	__reloadEnvForTesting();
	__resetStorageForTesting();
	__clearAttachmentTextCacheForTesting();
});

afterEach(async () => {
	process.env = originalEnv;
	__reloadEnvForTesting();
	__resetStorageForTesting();
	vi.restoreAllMocks();
	await fs.rm(root, { recursive: true, force: true });
});

afterAll(async () => {
	await terminateOcr();
});

const attach = async (scope: typeof me, name: string, data: Buffer | string): Promise<string> => {
	const stored = await userFiles.saveUploadedFile(scope, name, Buffer.isBuffer(data) ? data : Buffer.from(data));
	return `/home/${stored.key.split('/').slice(4).join('/')}`;
};

describe('read_attachment tool', () => {
	it('reads a file the user attached, by the path in their message', async () => {
		const filePath = await attach(me, 'referral.txt', 'Refer to Internal Medicine for uncontrolled BP.');

		expect(await read({ path: filePath })).toEqual({
			_version: '1',
			path: filePath,
			fileName: 'referral.txt',
			content: 'Refer to Internal Medicine for uncontrolled BP.',
			totalChars: 47,
		});
	});

	it('reads a scanned PDF through OCR and labels the page', async () => {
		const filePath = await attach(me, 'outside-lab.pdf', buildPdf([scannedLabResult()]));

		const { content } = await read({ path: filePath });

		expect(content).toContain('--- Page 1 (OCR) ---');
		expect(content).toMatch(/HBA1C 7\.9/);
	}, 60_000);

	it("never reaches another user's file: the path resolves inside the caller's own space", async () => {
		const theirs = await attach(someoneElse, 'private.txt', 'not yours');

		await expect(read({ path: theirs })).rejects.toThrow(/No such file/);
		expect((await read({ path: theirs }, someoneElse)).content).toBe('not yours');
	});

	it('rejects paths that try to leave the space, and paths outside storage', async () => {
		await attach(someoneElse, 'private.txt', 'not yours');

		await expect(read({ path: '/home/../../user-2/uploads/private.txt' })).rejects.toThrow(
			/may not contain '\.\.'/,
		);
		await expect(read({ path: 'storage://projects/proj-1/users/user-2/private.txt' })).rejects.toThrow(
			/is not an attachment path/,
		);
		await expect(read({ path: '/etc/passwd' })).rejects.toThrow(/is not an attachment path/);
		await expect(read({ path: '/home' })).rejects.toThrow(/not the storage folder/);
	});

	it('cuts a long file into parts with a marker and the offset to read on', async () => {
		const max = readAttachmentDefinition.MAX_CHARS;
		const filePath = await attach(me, 'long.txt', `${'a'.repeat(max)}${'b'.repeat(10)}`);

		const first = await read({ path: filePath });
		expect(first.totalChars).toBe(max + 10);
		expect(first.nextOffset).toBe(max);
		expect(first.content.startsWith('a'.repeat(max))).toBe(true);
		expect(first.content).toContain(`truncated: characters 0–${max} of ${max + 10} shown`);
		expect(first.content).toContain(`offset ${max}`);

		const rest = await read({ path: filePath, offset: max });
		expect(rest.content).toBe('b'.repeat(10));
		expect(rest.nextOffset).toBeUndefined();
	});

	it('extracts a file once when it is read in parts', async () => {
		const readUserFile = vi.spyOn(userFiles, 'readUserFile');
		const filePath = await attach(me, 'notes.txt', 'x'.repeat(readAttachmentDefinition.MAX_CHARS + 1));

		await read({ path: filePath });
		await read({ path: filePath, offset: readAttachmentDefinition.MAX_CHARS });

		expect(readUserFile).toHaveBeenCalledTimes(1);
	});

	it('says so when storage is off', async () => {
		process.env.LOOPWISE_STORAGE_BACKEND = 'none';
		__reloadEnvForTesting();
		__resetStorageForTesting();

		await expect(read({ path: '/home/uploads/a.txt' })).rejects.toThrow(/Permanent storage is disabled/);
	});
});
