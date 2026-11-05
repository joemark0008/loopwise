import { createIsomorphicCanvasFactory, extractText, getDocumentProxy, renderPageAsImage } from 'unpdf';

import { OcrTimeoutError, recognizeImage } from './ocr.js';

const MAX_PDF_PAGES = 1000;

/** Scanned pages read by OCR per document: a referral or a lab result is a few pages, a 300-page scan is not a chat. */
export const MAX_OCR_PAGES = 20;

/** Budget for the whole document's OCR, rendering included, so a large scan can't hold a chat turn for minutes. */
export const OCR_TIMEOUT_MS = 120_000;

/** Pages are rendered about this wide for OCR: ~240 dpi on an A4 or Letter page, which Tesseract reads well. */
const OCR_TARGET_WIDTH_PX = 2000;
const OCR_MAX_SCALE = 4;

/** Reads the text of one rendered page image (PNG). */
export type OcrReader = (image: Buffer, timeoutMs: number) => Promise<string>;

export interface PdfTextOptions {
	/** Reads scanned pages; `false` turns OCR off. Defaults to the in-process Tesseract worker. */
	ocr?: OcrReader | false;
	maxOcrPages?: number;
	ocrTimeoutMs?: number;
}

/**
 * Pulls the text out of a PDF so the agent can read one like any other file.
 *
 * Pages are kept apart and labelled: a PDF is the one format users routinely talk about by
 * page ("the table on page 4"), and the markers survive the truncation the read tool applies
 * downstream, so a partial read still says where it stopped.
 *
 * A page without a text layer (a scan or a phone photo saved as PDF) is rendered and read by OCR,
 * and labelled `(OCR)` so the reader knows its text may hold recognition errors.
 */
export const extractPdfText = async (data: Buffer, options: PdfTextOptions = {}): Promise<string> => {
	const pages = await extractPages(data);
	const scanned = pages.filter((page) => page.text === '').map((page) => page.number);
	const ocr =
		scanned.length > 0 && options.ocr !== false
			? await ocrPages(data, scanned, options)
			: { texts: new Map<number, string>(), notRead: [], maxPages: 0 };

	const withText = pages
		.map((page) => {
			const ocrText = ocr.texts.get(page.number);
			return ocrText ? { ...page, text: ocrText, ocr: true } : { ...page, ocr: false };
		})
		.filter((page) => page.text !== '');

	if (withText.length === 0) {
		throw new Error(
			`This PDF has ${pages.length} ${pages.length === 1 ? 'page' : 'pages'} but no text layer, which means it is scanned or made of images. ${describeOcrFailure(ocr)} Tell the user, and ask them for a clearer scan or the underlying data.`,
		);
	}

	const ocrRead = withText.filter((page) => page.ocr).map((page) => page.number);
	const header = [
		`PDF with ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}${describeEmptyPages(pages.length - withText.length)}.`,
		ocrRead.length > 0 &&
			`${pageWord(ocrRead)} ${formatPages(ocrRead)} ${ocrRead.length === 1 ? 'is' : 'are'} scanned and ${ocrRead.length === 1 ? 'was' : 'were'} read by OCR (optical character recognition), so ${ocrRead.length === 1 ? 'its' : 'their'} text may contain recognition errors: confirm names, doses, numbers and dates against the original.`,
		ocr.notRead.length > 0 && describeNotRead(ocr),
	].filter(Boolean);
	const body = withText.map((page) => `--- Page ${page.number}${page.ocr ? ' (OCR)' : ''} ---\n${page.text}`);

	return [header.join('\n'), ...body].join('\n\n');
};

interface PdfPage {
	number: number;
	text: string;
}

interface OcrOutcome {
	texts: Map<number, string>;
	/** Scanned pages left unread: past the page cap, or after OCR stopped. */
	notRead: number[];
	/** The page cap the read ran under. */
	maxPages: number;
	/** Why OCR stopped before the cap, when it did. */
	stoppedBecause?: string;
}

const extractPages = async (data: Buffer): Promise<PdfPage[]> => {
	let document: Awaited<ReturnType<typeof getDocumentProxy>>;
	try {
		document = await getDocumentProxy(new Uint8Array(data));
	} catch (error) {
		throw new Error(`This PDF could not be opened, so it may be corrupt or password-protected: ${reason(error)}`);
	}

	try {
		if (document.numPages > MAX_PDF_PAGES) {
			throw new Error(
				`This PDF has ${document.numPages} pages, above the ${MAX_PDF_PAGES}-page extraction limit. Ask for a smaller document or the relevant page range.`,
			);
		}

		const { text: pageTexts } = await extractText(document, { mergePages: false });
		return pageTexts.map((text, index) => ({ number: index + 1, text: normalizeWhitespace(text) }));
	} finally {
		await document.loadingTask.destroy();
	}
};

/** Renders each scanned page (up to the cap) and reads it, stopping at the first failure or when time runs out. */
const ocrPages = async (data: Buffer, pageNumbers: number[], options: PdfTextOptions): Promise<OcrOutcome> => {
	const read = options.ocr || recognizeImage;
	const maxPages = options.maxOcrPages ?? MAX_OCR_PAGES;
	const deadline = Date.now() + (options.ocrTimeoutMs ?? OCR_TIMEOUT_MS);
	const texts = new Map<number, string>();
	const toRead = pageNumbers.slice(0, maxPages);
	const outcome = (stoppedBecause?: string, readUpTo = toRead.length): OcrOutcome => ({
		texts,
		notRead: [...toRead.slice(readUpTo), ...pageNumbers.slice(maxPages)],
		maxPages,
		stoppedBecause,
	});

	let document: Awaited<ReturnType<typeof getDocumentProxy>>;
	try {
		const CanvasFactory = await createIsomorphicCanvasFactory(loadCanvas);
		document = await getDocumentProxy(new Uint8Array(data), { CanvasFactory });
	} catch (error) {
		return outcome(`OCR could not start (${reason(error)})`, 0);
	}

	try {
		for (const [index, pageNumber] of toRead.entries()) {
			const remaining = deadline - Date.now();
			if (remaining <= 0) {
				return outcome('OCR ran out of time', index);
			}
			try {
				const page = await document.getPage(pageNumber);
				const { width } = page.getViewport({ scale: 1 });
				const scale = Math.min(OCR_MAX_SCALE, Math.max(1, OCR_TARGET_WIDTH_PX / width));
				const image = await renderPageAsImage(document, pageNumber, { canvasImport: loadCanvas, scale });
				const text = normalizeWhitespace(await read(Buffer.from(image), deadline - Date.now()));
				if (text !== '') {
					texts.set(pageNumber, text);
				}
			} catch (error) {
				return outcome(
					error instanceof OcrTimeoutError ? 'OCR ran out of time' : `OCR failed (${reason(error)})`,
					index,
				);
			}
		}
		return outcome();
	} finally {
		await document.loadingTask.destroy();
	}
};

const loadCanvas = () => import('@napi-rs/canvas');

/**
 * pdf.js emits a space per positioned glyph run, which turns a table row into a line of
 * scattered words. Collapsing runs keeps it readable without pretending layout survived.
 */
const normalizeWhitespace = (text: string): string => {
	return text
		.replace(/\r\n?/g, '\n')
		.replace(/[ \t]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
};

const describeEmptyPages = (count: number): string => {
	if (count === 0) {
		return '';
	}
	return `, ${count} of which ${count === 1 ? 'holds' : 'hold'} no text and ${count === 1 ? 'is' : 'are'} left out below`;
};

const describeNotRead = ({ notRead, maxPages, stoppedBecause }: OcrOutcome): string => {
	const which = `${pageWord(notRead)} ${formatPages(notRead)}`;
	return stoppedBecause
		? `${stoppedBecause}, so scanned ${which} ${notRead.length === 1 ? 'was' : 'were'} not read.`
		: `OCR reads at most the first ${maxPages} scanned pages, so ${which} ${notRead.length === 1 ? 'was' : 'were'} not read: ask the user for the pages they need.`;
};

const describeOcrFailure = ({ stoppedBecause }: OcrOutcome): string => {
	return stoppedBecause
		? `${stoppedBecause}, so its text could not be read.`
		: 'OCR found no readable text on it: it may be blank, handwritten or too unclear to read.';
};

const pageWord = (pages: number[]): string => (pages.length === 1 ? 'Page' : 'Pages');

/** `1, 3–5, 9`: runs of consecutive pages collapse into a range. */
const formatPages = (pages: number[]): string => {
	const ranges: string[] = [];
	for (let start = 0; start < pages.length;) {
		let end = start;
		while (end + 1 < pages.length && pages[end + 1] === pages[end]! + 1) {
			end++;
		}
		ranges.push(end === start ? `${pages[start]}` : `${pages[start]}–${pages[end]}`);
		start = end + 1;
	}
	return ranges.join(', ');
};

const reason = (error: unknown): string => {
	return error instanceof Error ? error.message : String(error);
};
