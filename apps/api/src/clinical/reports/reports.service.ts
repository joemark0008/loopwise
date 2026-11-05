import { REPORT_BLOCK_TOOLS, splitReport } from '@loopwise/shared/report-blocks';
import { report } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { ChatRepository } from '../../chats/chat.repository.js';
import { HandlerError } from '../../common/errors/handler-error.js';
import { ReportPdf } from '../insights/models/report-pdf.model.js';
import { footerTemplate } from '../insights/report-pdf/report-html.js';
import { printHtmlToPdf } from '../insights/report-pdf/report-pdf.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { ClinicalDocument } from './models/clinical-document.model.js';
import { type EmbeddedResult, renderReportDocumentHtml } from './report-document-html.js';
import { type DocumentRow, ReportsRepository } from './reports.repository.js';

/**
 * Wise reports (DESIGN.md §7.2), loopwise's stories for Loopwise: a report's versions are the `report` tool outputs in
 * the chat, its numbers the tool results its blocks embed. Reads are owner-only; the PDF is audited as PHI leaving.
 */
@Injectable()
export class ReportsService {
	constructor(
		private readonly chats: ChatRepository,
		private readonly db: ClinicalDbService,
		private readonly reports: ReportsRepository,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** The outputs of tool calls in the user's own chat, by tool call id. */
	async toolOutputs(userId: string, chatId: string, toolCallIds: string[]): Promise<Record<string, EmbeddedResult>> {
		const parts = await this.chats.getOwnToolOutputs(userId, chatId, toolCallIds);
		return Object.fromEntries(parts.map(({ toolCallId, toolName, output }) => [toolCallId, { toolName, output }]));
	}

	/** The saved versions of a report in the user's own chat, oldest first. */
	async versions(userId: string, chatId: string, reportId: string): Promise<report.Output[]> {
		const outputs = await this.chats.getOwnReportOutputs(userId, chatId, reportId);
		return outputs.flatMap((output) => {
			const parsed = report.OutputSchema.safeParse(output);
			return parsed.success ? [parsed.data] : [];
		});
	}

	/** Prints one version of a report the user built, from its embedded results; audited as `report.export`. */
	async exportPdf(userId: string, chatId: string, toolCallId: string): Promise<ReportPdf> {
		const [part] = await this.chats.getOwnToolOutputs(userId, chatId, [toolCallId]);
		const parsed = part?.toolName === 'report' ? report.OutputSchema.safeParse(part.output) : null;
		if (!parsed?.success) {
			throw new HandlerError('NOT_FOUND', 'Report not found.');
		}
		const doc = parsed.data;
		const results = new Map(Object.entries(await this.toolOutputs(userId, chatId, blockRefs(doc.code))));
		const generatedAt = new Date().toISOString();
		const generatedBy = await this.db.asUser(userId, async (tx) => {
			if (doc.patientId && !(await this.reports.isVisible(tx, doc.patientId))) {
				throw new HandlerError('NOT_FOUND', 'Report not found.');
			}
			await this.reports.writeAudit(tx, {
				userId,
				patientId: doc.patientId,
				action: 'report.export',
				resourceId: toolCallId,
				reason: `PDF download of "${doc.title}" v${doc.version}`,
			});
			return this.reports.userName(tx, userId);
		});
		const html = renderReportDocumentHtml(doc, results, { generatedAt, generatedBy });
		const pdf = await printHtmlToPdf(html, footerTemplate({ subject: doc.title, generatedAt, generatedBy }));
		return {
			filename: `${doc.id}-v${doc.version}-${generatedAt.slice(0, 10)}.pdf`,
			mimeType: 'application/pdf',
			data: pdf.toString('base64'),
		};
	}

	/**
	 * Saves one version of a report the user built to its patient's chart, the clinician's own action from the report
	 * panel: frozen with the results it embeds, once per version, audited as `document.create`.
	 */
	async saveToChart(
		userId: string,
		chatId: string,
		toolCallId: string,
		wiseOrigin?: WiseOriginInput | null,
	): Promise<ClinicalDocument> {
		const [part] = await this.chats.getOwnToolOutputs(userId, chatId, [toolCallId]);
		const parsed = part?.toolName === 'report' ? report.OutputSchema.safeParse(part.output) : null;
		if (!parsed?.success) {
			throw new HandlerError('NOT_FOUND', 'Report not found.');
		}
		const doc = parsed.data;
		const { patientId } = doc;
		if (!patientId) {
			throw new HandlerError('BAD_REQUEST', 'This report is not about one patient, so it has no chart to go to.');
		}
		const data = await this.toolOutputs(userId, chatId, blockRefs(doc.code));
		const card = await this.wiseProposals.verifyAction(userId, wiseOrigin, 'saveReportToChart', undefined);
		assertCardPatient(card, patientId);
		return this.db.asUser(userId, async (tx) => {
			if (!(await this.reports.isVisible(tx, patientId))) {
				throw new HandlerError('NOT_FOUND', 'Report not found.');
			}
			if (await this.reports.documentBySource(tx, toolCallId)) {
				throw new HandlerError('CONFLICT', 'This version is already saved to the chart.');
			}
			const row = await this.reports.createDocument(tx, {
				patientId,
				title: doc.title,
				body: doc.code,
				data: JSON.parse(JSON.stringify(data)),
				version: doc.version,
				sourceChatId: chatId,
				sourceToolCallId: toolCallId,
				createdById: userId,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				resource: 'clinical_document',
				resourceId: row.id,
			});
			await this.reports.writeAudit(tx, {
				userId,
				patientId,
				action: 'document.create',
				resource: 'clinical_document',
				resourceId: row.id,
				reason: `Saved Wise report "${doc.title}" v${doc.version} to the chart`,
				origin: card?.origin ?? { source: 'wise_report', chatId, toolCallId },
			});
			return toDocument(row);
		});
	}

	/** The chart document a report version was saved as, if any (for the panel's Saved state). */
	savedDocument(userId: string, toolCallId: string): Promise<ClinicalDocument | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.reports.documentBySource(tx, toolCallId);
			return row && toDocument(row);
		});
	}

	/** A patient's saved documents, newest first; the list is part of the chart view. */
	patientDocuments(userId: string, patientId: string): Promise<ClinicalDocument[]> {
		return this.db.asUser(userId, async (tx) =>
			(await this.reports.patientDocuments(tx, patientId)).map(toDocument),
		);
	}

	/** One saved document, opened from the chart; audited as `document.view`. */
	document(userId: string, id: string): Promise<ClinicalDocument | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.reports.document(tx, id);
			if (!row) {
				return null;
			}
			await this.reports.writeAudit(tx, {
				userId,
				patientId: row.patientId,
				action: 'document.view',
				resource: 'clinical_document',
				resourceId: row.id,
				reason: row.title,
			});
			return toDocument(row);
		});
	}
}

/** The tool call ids a report's blocks embed. */
export function blockRefs(code: string): string[] {
	return [
		...new Set(
			splitReport(code).flatMap((segment) =>
				segment.kind !== 'markdown' && REPORT_BLOCK_TOOLS[segment.kind] ? [segment.ref] : [],
			),
		),
	];
}

function toDocument(row: DocumentRow): ClinicalDocument {
	return {
		id: row.id,
		patientId: row.patientId,
		kind: row.kind,
		title: row.title,
		body: row.body,
		data: row.data,
		version: row.version,
		sourceToolCallId: row.sourceToolCallId,
		createdByName: row.createdBy.name,
		createdAt: row.createdAt,
	};
}
