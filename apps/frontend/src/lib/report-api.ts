import {
	ExportReportPdfDocument,
	ExportWiseReportPdfDocument,
	SavedReportDocumentDocument,
	SaveReportToChartDocument,
} from '@/graphql/generated/graphql';
import { runMutation, runQuery } from '@/lib/apollo-procedures';

interface PdfFile {
	filename: string;
	mimeType: string;
	data: string;
}

/** Wise reports (DESIGN.md §7.2): PDFs of reports Wise built in one of your chats, printed on the server and audited. */
export const reportApi = {
	/** A `create_report` summary card's PDF (`report.export`), saved in the browser. */
	async downloadPdf({ chatId, toolCallId }: { chatId: string; toolCallId: string }): Promise<void> {
		const { exportReportPdf } = await runMutation(ExportReportPdfDocument, { chatId, toolCallId });
		save(exportReportPdf);
	},

	/** One version of a side-panel report (`report.export`), saved or sent to the browser's print dialog. */
	async downloadReportVersion({
		chatId,
		toolCallId,
		mode,
	}: {
		chatId: string;
		toolCallId: string;
		mode: 'download' | 'print';
	}): Promise<void> {
		const { exportWiseReportPdf } = await runMutation(ExportWiseReportPdfDocument, { chatId, toolCallId });
		if (mode === 'print') {
			print(exportWiseReportPdf);
		} else {
			save(exportWiseReportPdf);
		}
	},

	/** Saves one version of a report about a patient to their chart (the clinician's action). */
	async saveToChart({ chatId, toolCallId }: { chatId: string; toolCallId: string }) {
		return (await runMutation(SaveReportToChartDocument, { chatId, toolCallId })).saveReportToChart;
	},

	savedDocument: {
		queryKey: (toolCallId: string) => ['report', 'savedDocument', toolCallId] as const,
		fetch: async (toolCallId: string) =>
			(await runQuery(SavedReportDocumentDocument, { toolCallId })).savedReportDocument,
	},
};

const blobUrl = (file: PdfFile) =>
	URL.createObjectURL(
		new Blob([Uint8Array.from(atob(file.data), (char) => char.charCodeAt(0))], { type: file.mimeType }),
	);

function save(file: PdfFile) {
	const url = blobUrl(file);
	const link = document.createElement('a');
	link.href = url;
	link.download = file.filename;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The same PDF, printed from a hidden frame: what's printed is exactly what downloads. */
function print(file: PdfFile) {
	const url = blobUrl(file);
	const frame = document.createElement('iframe');
	frame.style.position = 'fixed';
	frame.style.width = '0';
	frame.style.height = '0';
	frame.style.border = '0';
	frame.src = url;
	frame.onload = () => {
		frame.contentWindow?.focus();
		frame.contentWindow?.print();
		setTimeout(() => {
			frame.remove();
			URL.revokeObjectURL(url);
		}, 60_000);
	};
	document.body.appendChild(frame);
}
