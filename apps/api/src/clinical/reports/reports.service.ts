import { reportBlocks } from '@loopwise/shared/report-blocks';
import { report } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { ChatRepository } from '../../chats/chat.repository.js';
import { EntityNotFoundError } from '../../common/errors/domain-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { ReportPdf } from '../insights/models/report-pdf.model.js';
import { footerTemplate } from '../insights/report-pdf/report-html.js';
import { printHtmlToPdf } from '../insights/report-pdf/report-pdf.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { ClinicalDocument } from './models/clinical-document.model.js';
import type { WiseReportSummary } from './models/wise-report-summary.model.js';
import { type EmbeddedResult, renderReportDocumentHtml } from './report-document-html.js';
import { ReportAlreadySavedError, ReportWithoutPatientError } from './reports.errors.js';
import { type DocumentRow, ReportsRepository } from './reports.repository.js';

/**
 * Wise reports (DESIGN.md §7.2): a report's versions are the `report` tool outputs in the chat, its numbers the tool
 * results its blocks embed. Reads are owner-only; the PDF is audited as PHI leaving (`report.export`), a version saved
 * to the chart as `document.create` and opening it as `document.view`, all through `AuditService` (RA 10173).
 */
@Injectable()
export class ReportsService {
	constructor(
		private readonly chats: ChatRepository,
		private readonly db: ClinicalDbService,
		private readonly reports: ReportsRepository,
		private readonly audit: AuditService,
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

	/**
	 * The reports library: the latest version of each report in the user's own chats, newest first. Report versions
	 * are folded from the newest `REPORT_PARTS_LIMIT` report outputs. A patient's name shows only while RLS lets the
	 * user see them; the report itself stays theirs either way.
	 */
	async listMine(userId: string): Promise<WiseReportSummary[]> {
		const parts = await this.chats.listOwnReportParts(userId, REPORT_PARTS_LIMIT);
		const latest = new Map<string, WiseReportSummary>();
		for (const part of parts) {
			const parsed = report.OutputSchema.safeParse(part.output);
			if (!parsed.success) {
				continue;
			}
			const key = `${part.chatId}:${parsed.data.id}`;
			const known = latest.get(key);
			if (known && known.version >= parsed.data.version) {
				continue;
			}
			latest.set(key, {
				chatId: part.chatId,
				chatTitle: part.chatTitle,
				reportId: parsed.data.id,
				title: parsed.data.title,
				version: parsed.data.version,
				toolCallId: part.toolCallId,
				patientId: parsed.data.patientId,
				patientName: null,
				updatedAt: known && known.updatedAt > part.createdAt ? known.updatedAt : part.createdAt,
			});
		}
		const summaries = [...latest.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
		const patientIds = [...new Set(summaries.flatMap((summary) => (summary.patientId ? [summary.patientId] : [])))];
		const names = await this.db.asUser(userId, (tx) => this.reports.patientNames(tx, patientIds));
		return summaries.map((summary) => ({
			...summary,
			patientName: summary.patientId ? (names.get(summary.patientId) ?? null) : null,
		}));
	}

	/** Prints one version of a report the user built, from its embedded results; audited as `report.export`. */
	async exportPdf(userId: string, chatId: string, toolCallId: string): Promise<ReportPdf> {
		const doc = await this.ownReport(userId, chatId, toolCallId);
		const results = new Map(Object.entries(await this.toolOutputs(userId, chatId, blockRefs(doc.code))));
		const generatedAt = new Date().toISOString();
		const generatedBy = await this.db.asUser(userId, async (tx) => {
			const patient = doc.patientId ? await this.reports.visiblePatient(tx, doc.patientId) : null;
			if (doc.patientId && !patient) {
				throw new EntityNotFoundError('Report', toolCallId);
			}
			await this.audit.record(tx, {
				action: 'EXPORT',
				event: 'report.export',
				entityType: 'Report',
				entityId: toolCallId,
				userId,
				patientId: doc.patientId,
				organizationId: patient?.organizationId ?? null,
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
	 * Saves one version of a report the user built to its patient's chart: frozen with the results it embeds, once per
	 * version (append-only), audited as `document.create`. With `wiseOrigin` (`propose_save_report`) the card is
	 * verified and settled in the same transaction.
	 */
	async saveToChart(
		userId: string,
		chatId: string,
		toolCallId: string,
		wiseOrigin?: WiseOriginInput | null,
	): Promise<ClinicalDocument> {
		const doc = await this.ownReport(userId, chatId, toolCallId);
		const { patientId } = doc;
		if (!patientId) {
			throw new ReportWithoutPatientError();
		}
		const data = await this.toolOutputs(userId, chatId, blockRefs(doc.code));
		return this.db.asUser(userId, async (tx) => {
			const patient = await this.reports.visiblePatient(tx, patientId);
			if (!patient) {
				throw new EntityNotFoundError('Report', toolCallId);
			}
			const card = await this.wiseProposals.verifyAction(
				userId,
				wiseOrigin,
				'saveReportToChart',
				patient.organizationId,
			);
			assertCardPatient(card, patientId);
			if (await this.reports.documentBySource(tx, toolCallId)) {
				throw new ReportAlreadySavedError();
			}
			const row = await this.reports.createDocument(tx, {
				patientId,
				title: doc.title,
				body: doc.code,
				data: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
				version: doc.version,
				sourceChatId: chatId,
				sourceToolCallId: toolCallId,
				createdById: userId,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'ClinicalDocument',
				entityId: row.id,
			});
			await this.audit.created(tx, {
				event: 'document.create',
				entityType: 'ClinicalDocument',
				entityId: row.id,
				userId,
				patientId,
				organizationId: patient.organizationId,
				reason: `Saved Wise report "${doc.title}" v${doc.version} to the chart`,
				origin: card?.origin ?? { via: 'wise_report', chatId, toolCallId },
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
			await this.audit.view(tx, {
				event: 'document.view',
				entityType: 'ClinicalDocument',
				entityId: row.id,
				userId,
				patientId: row.patientId,
				reason: row.title,
			});
			return toDocument(row);
		});
	}

	/** A `report` tool output of the user's own chat; not found otherwise. */
	private async ownReport(userId: string, chatId: string, toolCallId: string): Promise<report.Output> {
		const [part] = await this.chats.getOwnToolOutputs(userId, chatId, [toolCallId]);
		const parsed = part?.toolName === 'report' ? report.OutputSchema.safeParse(part.output) : null;
		if (!parsed?.success) {
			throw new EntityNotFoundError('Report', toolCallId);
		}
		return parsed.data;
	}
}

/** Report outputs the library reads at most (every version counts). */
const REPORT_PARTS_LIMIT = 2000;

/** The tool call ids a report's blocks embed. */
export function blockRefs(code: string): string[] {
	return [...new Set(reportBlocks(code).map((block) => block.ref))];
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
		createdByName: row.createdByName,
		createdAt: row.createdAt,
	};
}
