import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveCanonicalClinicPath } from './tools.js';

const temporaryFolders: string[] = [];

afterEach(() => {
	for (const folder of temporaryFolders.splice(0)) {
		fs.rmSync(folder, { recursive: true, force: true });
	}
});

describe('canonical clinic paths', () => {
	it('resolves a symlinked existing ancestor before appending missing segments', () => {
		const root = createTemporaryFolder();
		const clinic = path.join(root, 'clinic');
		const realDirectory = path.join(clinic, 'real');
		fs.mkdirSync(realDirectory, { recursive: true });
		fs.symlinkSync(realDirectory, path.join(clinic, 'alias'), directoryLinkType());

		expect(resolveCanonicalClinicPath('/alias/missing/report.md', clinic)).toEqual({
			realPath: path.join(fs.realpathSync.native(realDirectory), 'missing', 'report.md'),
			virtualPath: '/real/missing/report.md',
		});
	});

	it('rejects a missing target beneath a symlinked ancestor outside the clinic', () => {
		const root = createTemporaryFolder();
		const clinic = path.join(root, 'clinic');
		const outside = path.join(root, 'outside');
		fs.mkdirSync(clinic);
		fs.mkdirSync(outside);
		fs.symlinkSync(outside, path.join(clinic, 'escape'), directoryLinkType());

		expect(() => resolveCanonicalClinicPath('/escape/missing.md', clinic)).toThrow('outside the clinic folder');
	});
});

function createTemporaryFolder(): string {
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'loopwise-canonical-path-'));
	temporaryFolders.push(folder);
	return folder;
}

function directoryLinkType(): 'dir' | 'junction' {
	return process.platform === 'win32' ? 'junction' : 'dir';
}
