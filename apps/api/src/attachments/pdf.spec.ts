import { afterAll, describe, expect, it, vi } from 'vitest';

import { terminateOcr } from './ocr.js';
import { extractPdfText, type OcrReader } from './pdf.js';
import { buildPdf, scannedLabResult } from './testing/pdf-fixture.spec-helper.js';

/** Stands in for Tesseract where the test is about the bookkeeping around OCR, not recognition itself. */
const fakeOcr = (text = 'read by ocr'): OcrReader => vi.fn(async () => text);

describe('extractPdfText', () => {
	afterAll(async () => {
		await terminateOcr();
	});

	it('returns the text of each page behind a page marker', async () => {
		const text = await extractPdfText(buildPdf(['Revenue 1234', 'Costs 567']));

		expect(text).toContain('--- Page 1 ---');
		expect(text).toContain('Revenue 1234');
		expect(text).toContain('--- Page 2 ---');
		expect(text).toContain('Costs 567');
	});

	it('leads with the page count, so a truncated read still reveals what is missing', async () => {
		const text = await extractPdfText(buildPdf(['a', 'b', 'c']));

		expect(text.split('\n')[0]).toBe('PDF with 3 pages.');
	});

	it('says which pages held no text rather than dropping them silently', async () => {
		const text = await extractPdfText(buildPdf(['only this page', '']), { ocr: fakeOcr('') });

		expect(text.split('\n')[0]).toContain('1 of which holds no text');
		expect(text).not.toContain('--- Page 2');
	});

	it('explains that a PDF without any readable text could not be read, even by OCR', async () => {
		const blank = buildPdf(['', '']);

		await expect(extractPdfText(blank, { ocr: fakeOcr('  \n ') })).rejects.toThrow(/no text layer/);
		await expect(extractPdfText(blank, { ocr: fakeOcr('') })).rejects.toThrow(/OCR found no readable text/);
		await expect(extractPdfText(blank, { ocr: false })).rejects.toThrow(/no text layer/);
	});

	it('reports an unreadable file as corrupt or protected instead of throwing a parser error', async () => {
		await expect(extractPdfText(Buffer.from('this is not a pdf'))).rejects.toThrow(/corrupt or password-protected/);
	});

	it('collapses the runs of spaces pdf.js emits between positioned glyphs', async () => {
		const text = await extractPdfText(buildPdf(['Total     due     42']));

		expect(text).toContain('Total due 42');
	});

	describe('scanned pages', () => {
		it('reads a scanned page with Tesseract and labels it as OCR', async () => {
			const text = await extractPdfText(buildPdf(['Referral letter', scannedLabResult()]));

			expect(text).toContain('--- Page 1 ---\nReferral letter');
			expect(text).toContain('--- Page 2 (OCR) ---');
			expect(text).toMatch(/SYNTHETIC LAB RESULT/);
			expect(text).toMatch(/HBA1C 7\.9/);
			expect(text).toMatch(/Page 2 is scanned and was read by OCR/);
			expect(text).toMatch(/may contain recognition errors/);
		}, 60_000);

		it('reads only the first scanned pages up to the cap and names the ones left', async () => {
			const ocr = fakeOcr();
			const text = await extractPdfText(buildPdf(['intro', '', '', '', '']), { ocr, maxOcrPages: 2 });

			expect(ocr).toHaveBeenCalledTimes(2);
			expect(text).toContain('--- Page 2 (OCR) ---');
			expect(text).toContain('--- Page 3 (OCR) ---');
			expect(text).not.toContain('--- Page 4');
			expect(text).toContain('OCR reads at most the first 2 scanned pages, so Pages 4–5 were not read');
		});

		it('stops when the time budget runs out and says which pages were not read', async () => {
			const slow: OcrReader = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 30));
				return 'slow text';
			});
			const text = await extractPdfText(buildPdf(['intro', '', '', '']), { ocr: slow, ocrTimeoutMs: 20 });

			expect(text).toContain('OCR ran out of time, so scanned');
			expect(text).toContain('were not read');
		});

		it('keeps the text layer when OCR fails, and says why the scanned pages are missing', async () => {
			const failing: OcrReader = async () => {
				throw new Error('engine exploded');
			};
			const text = await extractPdfText(buildPdf(['typed page', '']), { ocr: failing });

			expect(text).toContain('typed page');
			expect(text).toContain('OCR failed (engine exploded), so scanned Page 2 was not read.');
		});
	});
});
