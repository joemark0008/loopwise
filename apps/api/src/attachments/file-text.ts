import { fileExtension, isBinaryDocument } from '@loopwise/shared/attachments';
import mammoth from 'mammoth';

import { extractPdfText } from './pdf.js';
import { describeWorkbook } from './workbook.js';

/**
 * Turns a file's bytes into something worth putting in a conversation, wherever it came from.
 *
 * PDFs go through text extraction (with OCR for scanned pages), a Word .docx gives its plain text, and an .xlsx comes back as an outline of its sheets rather
 * than their cells, which is what a reader needs before querying one. Every other binary format
 * is refused with an explanation: decoding a Parquet file as UTF-8 produces noise the model would
 * then reason about as if it meant something, which is worse than not reading the file at all.
 * @throws Error when the file has no text to offer.
 */
export const toReadableText = async (name: string, data: Buffer): Promise<string> => {
	const extension = fileExtension(name);

	if (extension === 'pdf') {
		return extractPdfText(data);
	}

	if (extension === 'docx') {
		return extractDocxText(data);
	}

	if (extension === 'xlsx') {
		return describeWorkbook(data);
	}

	return decodeText(name, data);
};

/** The paragraphs of a Word document, without its formatting; tables come out a cell per line. */
const extractDocxText = async (data: Buffer): Promise<string> => {
	let text: string;
	try {
		({ value: text } = await mammoth.extractRawText({ buffer: data }));
	} catch (error) {
		throw new Error(
			`This Word document could not be opened, so it may be corrupt or not a .docx: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	text = text.replace(/\n{3,}/g, '\n\n').trim();
	if (text === '') {
		throw new Error(
			'This Word document has no text. It may hold only images: ask the user for a PDF or photo of it.',
		);
	}
	return text;
};

const decodeText = (name: string, data: Buffer): string => {
	if (!isBinaryDocument(name)) {
		if (data[0] === 0xff && data[1] === 0xfe) {
			return new TextDecoder('utf-16le').decode(data.subarray(2));
		}
		if (data[0] === 0xfe && data[1] === 0xff) {
			return new TextDecoder('utf-16be').decode(data.subarray(2));
		}
		if (!data.includes(0)) {
			return data.toString('utf-8');
		}
	}

	const extension = fileExtension(name);
	throw new Error(
		`${name} is not a text file${extension ? ` (.${extension})` : ''}, so its contents cannot be read into the conversation. Describe what you need from it and ask the user for a text export such as CSV, or parse it in a sandbox if one is available.`,
	);
};
