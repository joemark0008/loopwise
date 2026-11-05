import { Injectable } from '@nestjs/common';

import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { REPORT_INCLUDE, type ReportRow } from '../diagnostic.includes.js';

/**
 * Released results for the doctor (`diagnostic_results`, read with their test, request and patient), on the caller's
 * `asUser` transaction: row-level security decides which patients are visible.
 */
@Injectable()
export class DiagnosticResultRepository {
	/**
	 * Released results nobody reviewed yet, of tests the practitioner requested, of visits they saw, or of patients in
	 * their care team (an unexpired care relationship), oldest release first.
	 */
	listToReview(tx: ClinicalTx, userId: string, limit: number): Promise<ReportRow[]> {
		return tx.diagnosticResult.findMany({
			where: {
				releasedAt: { not: null },
				reviewedAt: null,
				orderItem: { status: 'RELEASED', order: reviewerScope(userId) },
			},
			include: REPORT_INCLUDE,
			orderBy: { releasedAt: 'asc' },
			take: limit,
		});
	}

	/** The patient's released results, newest first. */
	listForPatient(tx: ClinicalTx, patientId: string, limit: number): Promise<ReportRow[]> {
		return tx.diagnosticResult.findMany({
			where: { releasedAt: { not: null }, orderItem: { order: { encounter: { patientId } } } },
			include: REPORT_INCLUDE,
			orderBy: [{ releasedAt: 'desc' }, { resultedAt: 'desc' }],
			take: limit,
		});
	}

	findById(tx: ClinicalTx, id: string): Promise<ReportRow | null> {
		return tx.diagnosticResult.findUnique({ where: { id }, include: REPORT_INCLUDE });
	}

	/** Whether the user reviews this result: requester, the visit's doctor or the patient's care team. */
	async isReviewer(tx: ClinicalTx, userId: string, resultId: string): Promise<boolean> {
		return (
			(await tx.diagnosticResult.count({
				where: { id: resultId, orderItem: { order: reviewerScope(userId) } },
			})) > 0
		);
	}

	/** Marks a released result reviewed unless someone already did; true when this call did. */
	async markReviewed(tx: ClinicalTx, id: string, userId: string, at: Date): Promise<boolean> {
		const { count } = await tx.diagnosticResult.updateMany({
			where: { id, reviewedAt: null, releasedAt: { not: null } },
			data: { reviewedAt: at, reviewedById: userId },
		});
		return count === 1;
	}
}

/** The orders a doctor reviews the results of. */
function reviewerScope(userId: string) {
	return {
		OR: [
			{ requestedBy: { userId } },
			{ encounter: { practitioner: { userId } } },
			{
				encounter: {
					patient: {
						careRelationships: {
							some: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
						},
					},
				},
			},
		],
	};
}
