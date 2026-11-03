import type { createReport } from '@loopwise/shared/tools';

import { getBrowser } from './headless-browser.js';
import { renderReportHtml, reportFooterTemplate } from './report-html.js';

/**
 * Prints a report to an A4 PDF. The page is static HTML set straight on a blank tab with every network request
 * aborted, so nothing in it can load or call out; the charts are already inline SVG.
 */
export function renderReportPdf(output: createReport.Output): Promise<Buffer> {
	return printHtmlToPdf(renderReportHtml(output), reportFooterTemplate(output));
}

/** Prints static HTML (no scripts, every request aborted) to an A4 PDF with Chrome's footer template. */
export async function printHtmlToPdf(html: string, footer: string): Promise<Buffer> {
	const browser = await getBrowser();
	const page = await browser.newPage();
	try {
		await page.setJavaScriptEnabled(false);
		await page.setRequestInterception(true);
		page.on('request', (request) => {
			if (request.url().startsWith('data:')) {
				void request.continue();
			} else {
				void request.abort();
			}
		});
		await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true,
			preferCSSPageSize: true,
			displayHeaderFooter: true,
			headerTemplate: '<span></span>',
			footerTemplate: footer,
		});
		return Buffer.from(pdf);
	} finally {
		await page.close().catch(() => {});
	}
}
