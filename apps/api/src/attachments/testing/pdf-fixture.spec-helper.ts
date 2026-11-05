import { readFileSync } from 'node:fs';
import path from 'node:path';

/** A page that is one picture and no text, as a scanner or a phone camera makes it. */
export interface ScannedPage {
	jpeg: Buffer;
	/** Pixel size of the JPEG. */
	width: number;
	height: number;
}

/**
 * A synthetic scan (900×300 JPEG) of three lines: "SYNTHETIC LAB RESULT", "HBA1C 7.9 PERCENT", "JUAN DELA CRUZ".
 * Made up for the tests; no real patient's data.
 */
export const scannedLabResult = (): ScannedPage => ({
	jpeg: readFileSync(path.join(import.meta.dirname, 'fixtures', 'scanned-lab-result.jpg')),
	width: 900,
	height: 300,
});

/**
 * Builds a real PDF by hand so the extraction tests exercise pdf.js rather than a stub.
 * Each text page carries one line of text; a page given an empty string gets no text object at
 * all, which is how a blank scanned page looks to an extractor. A `ScannedPage` is drawn as a
 * full-page image with no text layer, for the OCR fallback.
 */
export const buildPdf = (pages: Array<string | ScannedPage>): Buffer => {
	const catalog = '<</Type/Catalog/Pages 2 0 R>>';
	const font = '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>';

	// Object numbering: 1 catalog, 2 page tree, 3 font, then a page, a content stream and an image slot per page.
	const firstPageObject = 4;
	const kids = pages.map((_, index) => `${firstPageObject + index * 3} 0 R`).join(' ');

	const objects: Array<string | Buffer> = [catalog, `<</Type/Pages/Kids[${kids}]/Count ${pages.length}>>`, font];

	pages.forEach((page, index) => {
		const contentsObject = firstPageObject + index * 3 + 1;
		const imageObject = contentsObject + 1;

		if (typeof page === 'string') {
			const stream = page === '' ? '' : `BT /F1 14 Tf 20 120 Td (${escapePdfText(page)}) Tj ET`;
			objects.push(
				`<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Resources<</Font<</F1 3 0 R>>>>/Contents ${contentsObject} 0 R>>`,
				`<</Length ${stream.length}>>stream\n${stream}\nendstream`,
				'null',
			);
			return;
		}

		// One point per pixel: the page is exactly the picture.
		const stream = `q ${page.width} 0 0 ${page.height} 0 0 cm /Im1 Do Q`;
		objects.push(
			`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${page.width} ${page.height}]/Resources<</XObject<</Im1 ${imageObject} 0 R>>>>/Contents ${contentsObject} 0 R>>`,
			`<</Length ${stream.length}>>stream\n${stream}\nendstream`,
			Buffer.concat([
				Buffer.from(
					`<</Type/XObject/Subtype/Image/Width ${page.width}/Height ${page.height}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${page.jpeg.length}>>stream\n`,
					'latin1',
				),
				page.jpeg,
				Buffer.from('\nendstream', 'latin1'),
			]),
		);
	});

	const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
	let length = chunks[0]!.length;
	const offsets: number[] = [];
	objects.forEach((object, index) => {
		offsets.push(length);
		const chunk = Buffer.concat([
			Buffer.from(`${index + 1} 0 obj\n`, 'latin1'),
			typeof object === 'string' ? Buffer.from(object, 'latin1') : object,
			Buffer.from('\nendobj\n', 'latin1'),
		]);
		chunks.push(chunk);
		length += chunk.length;
	});

	let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) {
		trailer += `${String(offset).padStart(10, '0')} 00000 n \n`;
	}
	trailer += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${length}\n%%EOF\n`;
	chunks.push(Buffer.from(trailer, 'latin1'));

	return Buffer.concat(chunks);
};

const escapePdfText = (text: string): string => {
	return text.replace(/([\\()])/g, '\\$1');
};
