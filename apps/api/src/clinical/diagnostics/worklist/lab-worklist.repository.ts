import { Injectable } from '@nestjs/common';

import type { DiagnosticOrderStatus } from '../../../generated/prisma/enums.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { ITEM_INCLUDE, type ItemRow } from '../diagnostic.includes.js';
import type { NewResultValue } from './result-values.js';

/** The result row of an entry (the values are written alongside). */
export interface ResultEntry {
	performedById: string;
	findings: string | null;
	impression: string | null;
	remarks: string | null;
	resultedAt: Date;
}

/**
 * The lab desk's reads and writes: the tests of the user's clinics by status, and the results they enter and release
 * (`diagnostic_results`, `diagnostic_result_values`). Runs on the caller's `asUser` transaction.
 */
@Injectable()
export class LabWorklistRepository {
	listItems(
		tx: ClinicalTx,
		clinicIds: readonly string[],
		statuses: readonly DiagnosticOrderStatus[],
		take: number,
	): Promise<ItemRow[]> {
		return tx.diagnosticOrderItem.findMany({
			where: { status: { in: [...statuses] }, order: { encounter: { clinicId: { in: [...clinicIds] } } } },
			include: ITEM_INCLUDE,
			orderBy: { order: { createdAt: 'asc' } },
			take,
		});
	}

	async countByStatus(
		tx: ClinicalTx,
		clinicIds: readonly string[],
	): Promise<{ status: DiagnosticOrderStatus; count: number }[]> {
		const groups = await tx.diagnosticOrderItem.groupBy({
			by: ['status'],
			where: { order: { encounter: { clinicId: { in: [...clinicIds] } } } },
			_count: { _all: true },
		});
		return groups.map((group) => ({ status: group.status, count: group._count._all }));
	}

	/**
	 * Writes the test's result: creates it, or replaces the existing one's content and values (an edit before release,
	 * or a correction). A new entry is not released nor reviewed yet.
	 */
	async saveResult(
		tx: ClinicalTx,
		itemId: string,
		existingResultId: string | null,
		entry: ResultEntry,
		values: readonly NewResultValue[],
	): Promise<string> {
		const data = { ...entry, releasedAt: null, verifiedById: null, reviewedAt: null, reviewedById: null };
		if (!existingResultId) {
			const created = await tx.diagnosticResult.create({
				data: { ...data, orderItemId: itemId, values: { create: [...values] } },
				select: { id: true },
			});
			return created.id;
		}
		await tx.diagnosticResultValue.deleteMany({ where: { resultId: existingResultId } });
		await tx.diagnosticResult.update({
			where: { id: existingResultId },
			data: { ...data, values: { create: [...values] } },
		});
		return existingResultId;
	}

	async markReleased(tx: ClinicalTx, resultId: string, userId: string, at: Date): Promise<void> {
		await tx.diagnosticResult.update({ where: { id: resultId }, data: { releasedAt: at, verifiedById: userId } });
	}
}
