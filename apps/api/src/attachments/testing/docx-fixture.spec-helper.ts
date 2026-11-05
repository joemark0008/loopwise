import { strToU8, zipSync } from 'fflate';

/** Builds a minimal real .docx (a zip of the parts Word needs) with one paragraph per string. */
export const buildDocx = (paragraphs: string[]): Buffer => {
	const body = paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`);

	return Buffer.from(
		zipSync({
			'[Content_Types].xml': strToU8(
				'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
			),
			'_rels/.rels': strToU8(
				'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
			),
			'word/document.xml': strToU8(
				`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}</w:body></w:document>`,
			),
		}),
	);
};

const escapeXml = (text: string): string => {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};
