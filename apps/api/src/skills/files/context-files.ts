import { createHash } from 'node:crypto';
import fsSync from 'node:fs';
import path from 'node:path';

import type {
	FileContentResponse,
	FileContentSearchResponse,
	FileContentSearchResult,
	FileEditabilityGuidance,
	FileEditabilityReason,
	FileTreeEntry,
	FileWriteResponse,
} from '@quarry/shared/types';
import { spawn } from 'child_process';
import fs from 'fs/promises';

import { getRipgrepPath } from '../../agent/utils/ripgrep.js';
import {
	BUILT_IN_EXCLUSION_GLOBS,
	isWithinProjectFolder,
	loadQuarryignorePatterns,
	shouldExcludeEntry,
	toRealPath,
	toVirtualPath,
} from '../../agent/utils/tools.js';
import { HandlerError } from '../../common/errors/handler-error.js';
import { assertNoSymlinkInWritePath, canonicalizeWriteRoot, writeFileAtomically } from './safe-file-write.js';

const SEARCH_TIMEOUT_MS = 5_000;
const MAX_SEARCH_FILES = 200;
export const MAX_CONTEXT_FILE_SIZE = 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const FRONTMATTER_READ_SIZE = 8 * 1024;

export interface FileEditability {
	isEditable: boolean;
	reason: FileEditabilityReason | null;
	guidance: FileEditabilityGuidance | null;
}

type RipgrepMatchEntry = {
	type: 'match';
	data: {
		path: { text: string };
		lines: { text: string };
		line_number: number;
		submatches: unknown[];
	};
};

export async function getFileTree(projectFolder: string): Promise<FileTreeEntry[]> {
	return readDirectoryRecursive(projectFolder, projectFolder);
}

export async function readFileContent(filePath: string, projectFolder: string): Promise<FileContentResponse> {
	const { realPath } = resolveAndValidatePath(filePath, projectFolder);
	const editability = getFileEditability(filePath, realPath);
	const contentBuffer = await readValidatedFile(realPath, filePath);
	return {
		content: decodeTextContent(contentBuffer),
		hash: hashContent(contentBuffer),
		isEditable: editability.isEditable,
		reason: editability.reason,
		guidance: editability.guidance ?? undefined,
	};
}

export async function writeFileContent(
	filePath: string,
	content: string,
	expectedHash: string,
	projectFolder: string,
): Promise<FileWriteResponse> {
	validateExpectedHash(expectedHash);
	const contentBuffer = Buffer.from(content, 'utf-8');
	validateContentBuffer(contentBuffer);

	const { realPath, root } = resolveAndValidatePath(filePath, projectFolder);
	assertFileEditable(filePath, realPath);
	const currentContent = await readValidatedFile(realPath, filePath);
	assertExpectedHash(currentContent, expectedHash);

	try {
		writeFileAtomically({
			beforeRename: () => {
				const latestContent = readValidatedContextFileSync(realPath, filePath);
				assertExpectedHash(latestContent, expectedHash);
			},
			content,
			displayPath: filePath,
			root,
			target: realPath,
		});
	} catch (error) {
		throw toFileError(error, filePath);
	}

	return { hash: hashContent(contentBuffer) };
}

/** A new file; parent folders are created. It never replaces an existing file. */
export function createContextFile(filePath: string, content: string, projectRoot: string): void {
	validateContentBuffer(Buffer.from(content, 'utf-8'));
	try {
		const { realPath, root } = resolveAndValidatePath(filePath, projectRoot);
		const assertFree = () => {
			if (fsSync.existsSync(realPath)) {
				throw new HandlerError('CONFLICT', `${filePath} already exists.`);
			}
		};
		assertFree();
		fsSync.mkdirSync(path.dirname(realPath), { recursive: true });
		writeFileAtomically({ beforeRename: assertFree, content, displayPath: filePath, root, target: realPath });
	} catch (error) {
		throw toFileError(error, filePath);
	}
}

/** Replaces a file directly under `projectRoot`, unless it changed since it was read. Returns the new hash. */
export function overwriteContextFile(
	filePath: string,
	content: string,
	expectedHash: string,
	projectRoot: string,
): string {
	const contentBuffer = Buffer.from(content, 'utf-8');
	validateContentBuffer(contentBuffer);
	try {
		const { realPath, root } = resolveAndValidatePath(filePath, projectRoot);
		const assertUnchanged = () =>
			assertExpectedHash(readValidatedContextFileSync(realPath, filePath), expectedHash);
		assertUnchanged();
		writeFileAtomically({ beforeRename: assertUnchanged, content, displayPath: filePath, root, target: realPath });
	} catch (error) {
		throw toFileError(error, filePath);
	}
	return hashContent(contentBuffer);
}

/** Deletes a file directly under `projectRoot`, unless it changed since it was read. */
export function removeContextFile(filePath: string, expectedHash: string, projectRoot: string): void {
	try {
		const { realPath } = resolveAndValidatePath(filePath, projectRoot);
		assertExpectedHash(readValidatedContextFileSync(realPath, filePath), expectedHash);
		fsSync.rmSync(realPath);
	} catch (error) {
		throw toFileError(error, filePath);
	}
}

export function getFileEditability(filePath: string, realPath: string): FileEditability {
	const projectPath = normalizeProjectPath(filePath);
	if (hasGeneratedFrontmatter(realPath)) {
		const annotationsPath = siblingPathIfExists(filePath, realPath, 'annotations.md');
		if (annotationsPath) {
			return readOnly('generated', {
				message: 'This file is generated by context sync. Add human notes in annotations.md.',
				actionKind: 'file',
				actionPath: annotationsPath,
				actionLabel: 'Open annotations.md',
			});
		}
		return readOnly('generated', {
			message: 'This file is generated by context sync. Change its source instead.',
			actionKind: null,
			actionPath: null,
			actionLabel: null,
		});
	}
	if (fsSync.existsSync(`${realPath}.j2`)) {
		return readOnly('rendered-template', {
			message: 'This file is rendered from a Jinja template. Edit the template instead.',
			actionKind: 'file',
			actionPath: `${normalizeVirtualPath(filePath)}.j2`,
			actionLabel: 'Open template',
		});
	}
	if (
		projectPath.startsWith('repos/') ||
		projectPath.startsWith('docs/notion/') ||
		projectPath.startsWith('docs/confluence/') ||
		projectPath.startsWith('docs/obsidian/')
	) {
		return readOnly('synced-source', {
			message: 'This path is replaced by context sync. Change its source in quarry_config.yaml.',
			actionKind: 'file',
			actionPath: '/quarry_config.yaml',
			actionLabel: 'Open quarry_config.yaml',
		});
	}
	return { isEditable: true, reason: null, guidance: null };
}

export function assertFileEditable(filePath: string, realPath: string): void {
	const editability = getFileEditability(filePath, realPath);
	if (editability.isEditable) {
		return;
	}
	throw new HandlerError('FORBIDDEN', editability.guidance?.message ?? 'This file is read-only.');
}

export async function searchFileContents(query: string, projectFolder: string): Promise<FileContentSearchResponse> {
	const args = buildSearchArguments(query, projectFolder);
	return runContentSearch(getRipgrepPath(), args, projectFolder);
}

function buildSearchArguments(query: string, projectFolder: string): string[] {
	const args = [
		'--json',
		'--no-heading',
		'--line-number',
		'--fixed-strings',
		'--ignore-case',
		'--hidden',
		'--no-ignore',
		'--max-count',
		'10',
		'--max-filesize',
		'1M',
		'--max-columns',
		'500',
		'--max-columns-preview',
	];

	for (const exclusionGlob of BUILT_IN_EXCLUSION_GLOBS) {
		args.push('--glob', exclusionGlob);
	}

	for (const ignorePattern of loadQuarryignorePatterns(projectFolder)) {
		const cleanPattern = ignorePattern.endsWith('/') ? ignorePattern.slice(0, -1) : ignorePattern;
		args.push('--glob', `!${cleanPattern}`);
		args.push('--glob', `!${cleanPattern}/**`);
	}

	args.push('--regexp', query);
	args.push('--', projectFolder);
	return args;
}

function runContentSearch(
	ripgrepPath: string,
	args: string[],
	projectFolder: string,
): Promise<FileContentSearchResponse> {
	return new Promise((resolve, reject) => {
		const results = new Map<string, FileContentSearchResult>();
		const ripgrep = spawn(ripgrepPath, args, {
			cwd: projectFolder,
			env: { ...process.env },
		});
		let stdoutBuffer = '';
		let stderr = '';
		let settled = false;
		let truncated = false;

		const finish = () => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);
			resolve({ results: [...results.values()], truncated });
		};

		const fail = (error: Error) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);
			reject(error);
		};

		const collectLine = (line: string) => {
			if (!line.trim() || settled) {
				return;
			}

			try {
				const entry = JSON.parse(line) as RipgrepMatchEntry;
				if (entry.type !== 'match') {
					return;
				}

				const filePath = entry.data.path.text;
				if (!isWithinProjectFolder(filePath, projectFolder)) {
					return;
				}

				const virtualPath = toVirtualPath(filePath, projectFolder);
				const existing = results.get(virtualPath);
				if (existing) {
					existing.count += entry.data.submatches.length;
					return;
				}

				if (results.size >= MAX_SEARCH_FILES) {
					truncated = true;
					ripgrep.kill();
					finish();
					return;
				}

				results.set(virtualPath, {
					path: virtualPath,
					count: entry.data.submatches.length,
					line: entry.data.line_number,
					text: entry.data.lines.text.trim(),
				});
			} catch {
				return;
			}
		};

		const flushCompleteLines = () => {
			const lines = stdoutBuffer.split('\n');
			stdoutBuffer = lines.pop() ?? '';
			for (const line of lines) {
				collectLine(line);
			}
		};

		const timeout = setTimeout(() => {
			truncated = true;
			ripgrep.kill();
			finish();
		}, SEARCH_TIMEOUT_MS);

		ripgrep.stdout.on('data', (data) => {
			stdoutBuffer += data.toString();
			flushCompleteLines();
		});

		ripgrep.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		ripgrep.on('close', (code) => {
			collectLine(stdoutBuffer);
			if (code === 2) {
				fail(new Error(`ripgrep error: ${stderr}`));
				return;
			}
			finish();
		});

		ripgrep.on('error', (error) => {
			fail(new Error(`Failed to run ripgrep: ${error.message}`));
		});
	});
}

async function readDirectoryRecursive(dirPath: string, projectFolder: string): Promise<FileTreeEntry[]> {
	const dirEntries = await fs.readdir(dirPath, { withFileTypes: true });

	const parentRelativePath = path.relative(projectFolder, dirPath);
	const filtered = dirEntries.filter((entry) => !shouldExcludeEntry(entry.name, parentRelativePath, projectFolder));

	const entries: FileTreeEntry[] = [];

	for (const entry of filtered) {
		const fullPath = path.join(dirPath, entry.name);
		const virtualPath = '/' + path.relative(projectFolder, fullPath);

		if (entry.isDirectory()) {
			const children = await readDirectoryRecursive(fullPath, projectFolder);
			entries.push({
				name: entry.name,
				path: virtualPath,
				type: 'directory',
				children,
			});
		} else if (entry.isFile()) {
			entries.push({
				name: entry.name,
				path: virtualPath,
				type: 'file',
			});
		}
	}

	entries.sort((a, b) => {
		if (a.type === b.type) {
			return a.name.localeCompare(b.name);
		}
		return a.type === 'directory' ? -1 : 1;
	});

	return entries;
}

export function resolveAndValidatePath(virtualPath: string, projectFolder: string): { realPath: string; root: string } {
	try {
		const root = canonicalizeWriteRoot(projectFolder);
		const realPath = toRealPath(virtualPath, root, { resolveSymlinks: false });
		assertNoSymlinkInWritePath(root, realPath, virtualPath);
		return { realPath, root };
	} catch (error) {
		throw toFileError(error, virtualPath);
	}
}

async function readValidatedFile(filePath: string, displayPath: string): Promise<Buffer> {
	let fileHandle;
	try {
		fileHandle = await fs.open(filePath, fsSync.constants.O_RDONLY | fsSync.constants.O_NOFOLLOW);
		const stat = await fileHandle.stat();
		assertRegularFile(stat);
		assertFileSize(stat.size);
		const content = await fileHandle.readFile();
		validateContentBuffer(content);
		return content;
	} catch (error) {
		throw toFileError(error, displayPath);
	} finally {
		await fileHandle?.close();
	}
}

export function readValidatedContextFileSync(filePath: string, displayPath: string): Buffer {
	let fileDescriptor: number | null = null;
	try {
		fileDescriptor = fsSync.openSync(filePath, fsSync.constants.O_RDONLY | fsSync.constants.O_NOFOLLOW);
		const stat = fsSync.fstatSync(fileDescriptor);
		assertRegularFile(stat);
		assertFileSize(stat.size);
		const content = fsSync.readFileSync(fileDescriptor);
		validateContentBuffer(content);
		return content;
	} catch (error) {
		throw toFileError(error, displayPath);
	} finally {
		if (fileDescriptor !== null) {
			fsSync.closeSync(fileDescriptor);
		}
	}
}

export function validateContentBuffer(content: Buffer): void {
	assertFileSize(content.byteLength);
	if (content.includes(0)) {
		throw new HandlerError('BAD_REQUEST', 'Binary files cannot be opened in the file explorer.');
	}
	decodeTextContent(content);
}

export function decodeTextContent(content: Buffer): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(content);
	} catch {
		throw new HandlerError('BAD_REQUEST', 'Only valid UTF-8 text files can be opened in the file explorer.');
	}
}

function assertRegularFile(stat: fsSync.Stats): void {
	if (!stat.isFile()) {
		throw new HandlerError('BAD_REQUEST', 'Only regular files can be opened in the file explorer.');
	}
}

function assertFileSize(size: number): void {
	if (size > MAX_CONTEXT_FILE_SIZE) {
		throw new HandlerError('BAD_REQUEST', 'File is too large (max 1 MB).');
	}
}

function validateExpectedHash(expectedHash: string): void {
	if (!SHA256_PATTERN.test(expectedHash)) {
		throw new HandlerError('BAD_REQUEST', 'The expected file hash is invalid.');
	}
}

function assertExpectedHash(content: Buffer, expectedHash: string): void {
	if (hashContent(content) !== expectedHash) {
		throw new HandlerError('CONFLICT', 'This file changed on disk. Reload it before saving your changes.');
	}
}

export function hashContent(content: Buffer): string {
	return createHash('sha256').update(content).digest('hex');
}

function hasGeneratedFrontmatter(filePath: string): boolean {
	let fileDescriptor: number | null = null;
	try {
		fileDescriptor = fsSync.openSync(filePath, fsSync.constants.O_RDONLY | fsSync.constants.O_NOFOLLOW);
		const buffer = Buffer.alloc(FRONTMATTER_READ_SIZE);
		const bytesRead = fsSync.readSync(fileDescriptor, buffer, 0, buffer.byteLength, 0);
		const prefix = buffer.subarray(0, bytesRead).toString('utf-8');
		if (!prefix.startsWith('---\n') && !prefix.startsWith('---\r\n')) {
			return false;
		}
		const frontmatter = prefix.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
		return frontmatter?.split(/\r?\n/).some((line) => /^type:\s*generated\s*$/.test(line.trim())) ?? false;
	} catch {
		return false;
	} finally {
		if (fileDescriptor !== null) {
			fsSync.closeSync(fileDescriptor);
		}
	}
}

function readOnly(reason: FileEditabilityReason, guidance: FileEditabilityGuidance): FileEditability {
	return { isEditable: false, reason, guidance };
}

function siblingPathIfExists(filePath: string, realPath: string, siblingName: string): string | null {
	const sibling = path.join(path.dirname(realPath), siblingName);
	if (!fsSync.existsSync(sibling)) {
		return null;
	}
	const virtualDirectory = path.posix.dirname(normalizeVirtualPath(filePath));
	return path.posix.join(virtualDirectory, siblingName);
}

function normalizeVirtualPath(filePath: string): string {
	return `/${normalizeProjectPath(filePath)}`;
}

function normalizeProjectPath(projectPath: string): string {
	return projectPath.replaceAll('\\', '/').replace(/^\/+/, '');
}

function toFileError(error: unknown, filePath: string): HandlerError {
	if (error instanceof HandlerError) {
		return error;
	}

	const code = (error as NodeJS.ErrnoException).code;
	if (code === 'ENOENT') {
		return new HandlerError('NOT_FOUND', `File not found: ${filePath}`);
	}
	// These messages quote the absolute path, which project members must not see.
	if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS' || code === 'ENOSPC') {
		return new HandlerError(
			'BAD_REQUEST',
			`The server could not write ${filePath}: its disk is read-only or full.`,
		);
	}
	if (code === 'ELOOP' || code === 'EMLINK') {
		return new HandlerError('FORBIDDEN', `Access denied for path: ${filePath}`);
	}

	const message = error instanceof Error ? error.message : '';
	if (
		message.includes('outside the project folder') ||
		message.includes('outside the repository') ||
		message.includes('protected .git metadata') ||
		message.includes('protected environment file') ||
		message.includes('excluded directory') ||
		message.includes('ignored by .quarryignore') ||
		message.includes('symlink')
	) {
		return new HandlerError('FORBIDDEN', message);
	}

	return new HandlerError('BAD_REQUEST', message || `Unable to access file: ${filePath}`);
}
