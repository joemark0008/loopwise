import type { listResultsToReview } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { AuditService } from '../../audit/audit.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../../wise-proposals/wise-proposal.service.js';
import type { ReportRow } from '../diagnostic.includes.js';
import {
	CriticalReviewNoteRequiredError,
	NotResultReviewerError,
	ResultAlreadyReviewedError,
	ResultNotReleasedError,
} from '../diagnostics.errors.js';
import { ResultUrgency } from '../models/diagnostic-enums.js';
import { DiagnosticOrderRepository } from '../orders/diagnostic-order.repository.js';
import { DiagnosticResultRepository } from './diagnostic-result.repository.js';
import type { ReviewResultInput } from './dto/review-result.input.js';
import { type DiagnosticReport, toDiagnosticReport } from './models/diagnostic-report.model.js';

const INBOX_LIMIT = 200;
const PATIENT_RESULTS_LIMIT = 500;

/** Inbox order: critical, abnormal, unflagged (reports to read), normal; oldest release first within each. */
const URGENCY_RANK: Record<ResultUrgency, number> = { CRITICAL: 0, ABNORMAL: 1, UNFLAGGED: 2, NORMAL: 3 };

/**
 * The doctor's side of results: the inbox of released results to review (critical first) and the patient's results
 * tab. Reviewing is for a physician who requested the test, saw the visit, or is in the patient's care team. A critical
 * result confirmed from a Wise card needs the doctor's note; critical values never get an automated patient message.
 * Every list and review writes an audit row (RA 10173).
 */
@Injectable()
export class ResultsInboxService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly results: DiagnosticResultRepository,
		private readonly orders: DiagnosticOrderRepository,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** Released results waiting for the user's review, critical first; empty for users who aren't practitioners. */
	toReview(userId: string): Promise<DiagnosticReport[]> {
		return this.db.asUser(userId, async (tx) => {
			const reports = await this.listToReview(tx, userId);
			await this.auditListed(tx, userId, reports, 'result.inbox');
			return reports;
		});
	}

	/** The patient's released results, newest first; audited as a view of the patient's record. */
	forPatient(userId: string, patientId: string): Promise<DiagnosticReport[]> {
		return this.db.asUser(userId, async (tx) => {
			const rows = await this.results.listForPatient(tx, patientId, PATIENT_RESULTS_LIMIT);
			const reports = rows.map(toDiagnosticReport);
			await this.auditListed(tx, userId, reports, 'result.list');
			return reports;
		});
	}

	/**
	 * Marks a released result reviewed, once, with the reviewer's note in the audit row. With `wiseOrigin` (a
	 * `propose_result_review` card) the card is verified against the visit's organization, a critical result needs the note, and the
	 * card is settled in the same transaction.
	 */
	review(userId: string, input: ReviewResultInput): Promise<DiagnosticReport> {
		const note = input.note?.trim() || null;
		return this.db.asUser(userId, async (tx) => {
			const row = await this.results.findById(tx, input.resultId);
			if (!row) {
				throw new EntityNotFoundError('DiagnosticResult', input.resultId);
			}
			const report = toDiagnosticReport(row);
			const { clinic, patientId } = row.orderItem.order.encounter;
			const card = await this.wiseProposals.verifyAction(
				userId,
				input.wiseOrigin,
				'reviewResult',
				clinic.organizationId,
			);
			assertCardPatient(card, patientId);
			if (card && report.urgency === ResultUrgency.CRITICAL && !note) {
				throw new CriticalReviewNoteRequiredError();
			}
			if (!row.releasedAt) {
				throw new ResultNotReleasedError();
			}
			if (!(await this.isReviewer(tx, userId, row))) {
				throw new NotResultReviewerError();
			}
			if (!(await this.results.markReviewed(tx, row.id, userId, new Date()))) {
				throw new ResultAlreadyReviewedError();
			}
			await this.audit.updated(tx, {
				event: 'result.review',
				entityType: 'DiagnosticResult',
				entityId: row.id,
				userId,
				patientId,
				clinicId: clinic.id,
				organizationId: clinic.organizationId,
				changes: { before: { reviewedAt: null }, after: { reviewedAt: new Date().toISOString() } },
				reason: note,
				origin: card?.origin,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'DiagnosticResult',
				entityId: row.id,
			});
			return toDiagnosticReport((await this.results.findById(tx, row.id)) ?? row);
		});
	}

	/**
	 * Wise's `list_results_to_review`: the inbox, in a chart chat that patient's only, filtered by urgency; one audit
	 * row per patient listed (reason `Wise list_results_to_review`).
	 */
	resultsToReviewForWise(
		userId: string,
		opts: { patientId?: string; urgency?: listResultsToReview.Input['urgency']; limit: number },
	): Promise<{ results: listResultsToReview.Result[]; truncated: boolean }> {
		return this.db.asUser(userId, async (tx) => {
			const matching = (await this.listToReview(tx, userId)).filter(
				(report) =>
					(!opts.patientId || report.patient.id === opts.patientId) &&
					(!opts.urgency || report.urgency === opts.urgency.toUpperCase()),
			);
			const listed = matching.slice(0, opts.limit);
			await this.auditListed(tx, userId, listed, 'result.list', 'Wise list_results_to_review');
			return {
				truncated: matching.length > listed.length,
				results: listed.map((report) => ({
					id: report.id,
					test: report.test.name,
					orderNo: report.order.orderNo,
					values: report.values.map(({ name, value, unit, referenceRange, flag }) => ({
						name,
						value,
						unit,
						referenceRange,
						flag,
					})),
					findings: report.findings,
					impression: report.impression,
					urgency: report.urgency.toLowerCase() as listResultsToReview.Result['urgency'],
					releasedAt: report.releasedAt?.toISOString() ?? null,
					patient: {
						id: report.patient.id,
						name: `${report.patient.firstName} ${report.patient.lastName}`,
						birthDate: report.patient.birthDate,
					},
				})),
			};
		});
	}

	private async listToReview(tx: ClinicalTx, userId: string): Promise<DiagnosticReport[]> {
		if (!(await this.orders.findPractitionerIdOfUser(tx, userId))) {
			return [];
		}
		const rows = await this.results.listToReview(tx, userId, INBOX_LIMIT);
		return rows
			.map(toDiagnosticReport)
			.sort(
				(a, b) =>
					URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
					(a.releasedAt?.getTime() ?? 0) - (b.releasedAt?.getTime() ?? 0),
			);
	}

	private async isReviewer(tx: ClinicalTx, userId: string, row: ReportRow): Promise<boolean> {
		return (
			Boolean(await this.orders.findPractitionerIdOfUser(tx, userId)) &&
			this.results.isReviewer(tx, userId, row.id)
		);
	}

	/** One VIEW row per patient listed. */
	private async auditListed(
		tx: ClinicalTx,
		userId: string,
		reports: readonly DiagnosticReport[],
		event: string,
		reason?: string,
	): Promise<void> {
		const patientIds = [...new Set(reports.map((report) => report.patient.id))];
		await this.audit.recordMany(
			tx,
			patientIds.map((patientId) => ({
				action: 'VIEW' as const,
				event,
				entityType: 'Patient',
				entityId: patientId,
				userId,
				patientId,
				reason: reason ?? null,
			})),
		);
	}
}
