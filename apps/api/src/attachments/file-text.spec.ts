import { describe, expect, it } from 'vitest';

import { toReadableText } from './file-text.js';
import { buildDocx } from './testing/docx-fixture.spec-helper.js';

describe('toReadableText', () => {
	it('decodes UTF-16 text files with either byte-order mark', async () => {
		const littleEndian = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('name,amount', 'utf16le')]);
		const bigEndianBody = Buffer.from('name,amount', 'utf16le').swap16();
		const bigEndian = Buffer.concat([Buffer.from([0xfe, 0xff]), bigEndianBody]);

		await expect(toReadableText('report.csv', littleEndian)).resolves.toBe('name,amount');
		await expect(toReadableText('report.csv', bigEndian)).resolves.toBe('name,amount');
	});

	it('rejects binary content even when its first NUL appears late in the file', async () => {
		const data = Buffer.concat([Buffer.from('a'.repeat(9000)), Buffer.from([0]), Buffer.from('tail')]);

		await expect(toReadableText('report.txt', data)).rejects.toThrow('is not a text file');
	});

	it('reads the text of a Word document', async () => {
		const docx = buildDocx(['Referral to: Internal Medicine', 'Reason: uncontrolled hypertension']);

		await expect(toReadableText('referral.docx', docx)).resolves.toBe(
			'Referral to: Internal Medicine\n\nReason: uncontrolled hypertension',
		);
	});

	it('explains a .docx that is not one, or has no text, rather than returning noise', async () => {
		await expect(toReadableText('referral.docx', Buffer.from('plain text'))).rejects.toThrow(/could not be opened/);
		await expect(toReadableText('blank.docx', buildDocx([]))).rejects.toThrow(/has no text/);
	});
});
