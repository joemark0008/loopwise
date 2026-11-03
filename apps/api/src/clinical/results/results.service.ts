import { Injectable } from '@nestjs/common';
import type { listResultsToReview } from '@quarry/shared/tools';
import { wiseActionToolsFor } from '@quarry/shared/wise-actions';

import { HandlerError } from '../../common/errors/handler-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ResultFlag } from '../../generated/prisma/enums.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import { ClinicalAuditRepository } from '../audit/clinical-audit.repository.js';
import { OrderService } from '../orders/order.service.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { ReviewResultInput } from './dto/review-result.input.js';
import { type ResultItem, ResultUrgency } from './models/result-review.model.js';
import { type InboxRow, ResultRepository } from './result.repository.js';

type WiseResult = listResultsToReview.Result;

const INBOX_LIMIT = 200;
const PATIENT_RESULTS_LIMIT = 500;

const URGENCY_BY_FLAG: Record<ResultFlag, ResultUrgency> = {
	critical_high: ResultUrgency.critical,
	critical_low: ResultUrgency.critical,
	high: ResultUrgency.abnormal,
	low: ResultUrgency.abnormal,
	abnormal: ResultUrgency.abnormal,
	normal: ResultUrgency.normal,
};

/** Inbox order: critical, abnormal, unflagged (reports to read), normal; oldest first within each. */
const URGENCY_RANK: Record<ResultUrgency, number> = { critical: 0, abnormal: 1, unflagged: 2, normal: 3 };

/**
 * The results inbox (DESIGN.md §4.1 steps 5–6, §4.2 "result not reviewed in 48h"): what the clinician must review,
 * critical first, and the review itself. Row-level security decides what is visible; review is for the ordering
 * clinician, or for any clinician who can see the patient when the result came without a Loopwise order.
 */
@Injectable()
export class ResultsService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly results: ResultRepository,
		private readonly orders: OrderService,
		private readonly organizations: OrganizationRepository,
		private readonly audit: ClinicalAuditRepository,
		private readonly wiseProposals: WiseProposalService,
	) {}

	async toReview(userId: string): Promise<ResultItem[]> {
		const ownOrgIds = await this.ownOrgIds(userId);
		const rows = await this.db.asUser(userId, (tx) =>
			this.results.listToReview(tx, userId, ownOrgIds, INBOX_LIMIT),
		);
		return rows
			.map(toResultItem)
			.sort(
				(a, b) =>
					URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
					a.receivedAt.getTime() - b.receivedAt.getTime(),
			);
	}

	/**
	 * Wise's `list_results_to_review`: the inbox, in a chart chat that patient's only, each with its latest rules-engine
	 * evaluation. Read as the user; one audit row per patient listed (`result.list`, reason `Wise`).
	 */
	async toReviewForWise(
		userId: string,
		opts: { patientId?: string; urgency?: ResultUrgency; limit: number },
	): Promise<{ results: WiseResult[]; truncated: boolean }> {
		const items = (await this.toReview(userId)).filter(
			(item) =>
				(!opts.patientId || item.patient.id === opts.patientId) &&
				(!opts.urgency || item.urgency === opts.urgency),
		);
		const listed = items.slice(0, opts.limit);
		return this.db.asUser(userId, async (tx) => {
			const evaluations = await this.results.latestEvaluations(
				tx,
				listed.map((item) => item.id),
			);
			for (const patientId of new Set(listed.map((item) => item.patient.id))) {
				await this.audit.write(tx, {
					userId,
					orgId: null,
					patientId,
					action: 'result.list',
					resource: 'patient',
					resourceId: patientId,
					reason: 'Wise list_results_to_review',
				});
			}
			return {
				truncated: items.length > listed.length,
				results: listed.map((item) => {
					const evaluation = evaluations.find((row) => row.resultId === item.id);
					return {
						id: item.id,
						test: item.display ?? item.code,
						value: item.value,
						unit: item.unit,
						refRange: item.refRange,
						flag: item.flag,
						urgency: item.urgency,
						resultedAt: item.resultedAt.toISOString(),
						patient: {
							id: item.patient.id,
							name: `${item.patient.givenName} ${item.patient.familyName}`,
							birthDate: item.patient.birthDate,
						},
						lab: item.sourceFacility.name,
						evaluation: evaluation
							? {
									pathwayName: evaluation.pathway.name,
									classification: evaluation.classification,
									urgency: evaluation.urgency,
									reason: evaluation.reason,
									guideline: evaluation.guideline,
									slaHours: evaluation.slaHours,
								}
							: null,
					};
				}),
			};
		});
	}

	async forPatient(userId: string, patientId: string): Promise<ResultItem[]> {
		return this.db.asUser(userId, async (tx) => {
			const rows = await this.results.listForPatient(tx, patientId, PATIENT_RESULTS_LIMIT);
			if (rows.length > 0) {
				await this.audit.write(tx, {
					userId,
					orgId: null,
					patientId,
					action: 'result.list',
					resource: 'patient',
					resourceId: patientId,
				});
			}
			return rows.map(toResultItem);
		});
	}

	/**
	 * Marks a result reviewed. With `wiseOrigin` (a `propose_result_review` card) the card is verified at the ordering
	 * facility and settled in the same transaction, and a critical result needs the clinician's note.
	 */
	async review(userId: string, input: ReviewResultInput): Promise<ResultItem> {
		const ownOrgIds = await this.ownOrgIds(userId);
		const card = input.wiseOrigin ? await this.verifyReviewCard(userId, input) : undefined;
		return this.db.asUser(userId, async (tx) => {
			const row = await this.results.findForReview(tx, input.resultId);
			if (!row) {
				throw new HandlerError('NOT_FOUND', 'Result not found');
			}
			assertCardPatient(card, row.patientId);
			const mayReview = row.order ? row.order.orderingDoctorId === userId : !ownOrgIds.includes(row.sourceOrgId);
			if (!mayReview) {
				throw new HandlerError('FORBIDDEN', 'Only the clinician who ordered the test reviews its result.');
			}
			const reviewedAt = new Date();
			if ((await this.results.markReviewed(tx, row.id, userId, reviewedAt)) === 0) {
				throw new HandlerError('CONFLICT', 'This result was already reviewed.');
			}
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { resource: 'result', resourceId: row.id });
			}
			await this.audit.write(tx, {
				userId,
				orgId: row.order?.orderingOrgId ?? null,
				patientId: row.patientId,
				action: 'result.review',
				resource: 'result',
				resourceId: row.id,
				reason: input.note || null,
				origin: card?.origin,
			});
			let orderStatus = row.order?.status ?? null;
			if (row.order && (await this.advanceOrderAfterReview(tx, row.order.id))) {
				orderStatus = 'reviewed';
			}
			return { ...toResultItem(row), reviewedAt, orderStatus };
		});
	}

	private async verifyReviewCard(userId: string, input: ReviewResultInput) {
		const row = await this.db.asUser(userId, (tx) => this.results.findForReview(tx, input.resultId));
		if (!row) {
			throw new HandlerError('NOT_FOUND', 'Result not found');
		}
		if (URGENCY_BY_FLAG[row.flag ?? 'normal'] === ResultUrgency.critical && !input.note?.trim()) {
			throw new HandlerError('BAD_REQUEST', 'A critical result needs your note of what you did about it.');
		}
		return this.wiseProposals.verify(userId, input.wiseOrigin!, {
			toolNames: wiseActionToolsFor('reviewResult'),
			facilityId: row.order?.orderingOrgId,
		});
	}

	/**
	 * The seam to the order lifecycle (owned by `clinical/orders/`): the order becomes `reviewed` once none of its
	 * results awaits review. Swap the call here when the orders module's transition methods change.
	 */
	private advanceOrderAfterReview(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
		return this.orders.setReviewed(tx, orderId);
	}

	private async ownOrgIds(userId: string): Promise<string[]> {
		return (await this.organizations.getUserFacilities(userId)).map((org) => org.id);
	}
}

export function urgencyOf(flag: ResultFlag | null): ResultUrgency {
	return flag ? URGENCY_BY_FLAG[flag] : ResultUrgency.unflagged;
}

function toResultItem(row: InboxRow): ResultItem {
	return {
		id: row.id,
		code: row.code,
		codeSystem: row.codeSystem,
		display: row.display,
		value: row.value,
		unit: row.unit,
		refRange: row.refRange,
		flag: row.flag,
		urgency: urgencyOf(row.flag),
		resultedAt: row.resultedAt,
		receivedAt: row.receivedAt,
		reviewedAt: row.reviewedAt,
		patient: {
			id: row.patient.id,
			givenName: row.patient.givenName,
			familyName: row.patient.familyName,
			birthDate: row.patient.birthDate.toISOString().slice(0, 10),
			sex: row.patient.sex,
		},
		sourceFacility: { id: row.sourceOrg.id, name: row.sourceOrg.name, slug: '' },
		orderId: row.order?.id ?? null,
		orderStatus: row.order?.status ?? null,
		orderPriority: row.order?.priority ?? null,
	};
}
