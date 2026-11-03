import { Injectable } from '@nestjs/common';

import type { Pathway, Prisma, Result, ResultEvaluation } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

export type ResultEvaluationRow = ResultEvaluation & { pathway: Pick<Pathway, 'name'> };

/**
 * Pathways and result evaluations. Every method takes the caller's transaction: `ClinicalDbService.asSystem` for the
 * rules engine's own work, `asUser` for reads on a user's behalf, where row-level security decides.
 */
@Injectable()
export class PathwayRepository {
	listActive(tx: Tx): Promise<Pathway[]> {
		return tx.pathway.findMany({ where: { active: true }, orderBy: { key: 'asc' } });
	}

	findResult(tx: Tx, id: string): Promise<Result | null> {
		return tx.result.findUnique({ where: { id } });
	}

	/** The latest evaluation of a result: a newer pathway version adds a row, the older ones stay. */
	latestEvaluation(tx: Tx, resultId: string): Promise<ResultEvaluationRow | null> {
		return tx.resultEvaluation.findFirst({
			where: { resultId },
			orderBy: [{ evaluatedAt: 'desc' }, { ruleVersion: 'desc' }],
			include: { pathway: { select: { name: true } } },
		});
	}

	/** Stores an evaluation once per result and rule version; a repeat (a re-delivered event) returns the stored one. */
	async storeEvaluation(
		tx: Tx,
		data: Prisma.ResultEvaluationUncheckedCreateInput,
	): Promise<{ row: ResultEvaluation; created: boolean }> {
		const key = { resultId: data.resultId, pathwayKey: data.pathwayKey, ruleVersion: data.ruleVersion };
		const { count } = await tx.resultEvaluation.createMany({ data: [data], skipDuplicates: true });
		const row = await tx.resultEvaluation.findUniqueOrThrow({ where: { resultId_pathwayKey_ruleVersion: key } });
		return { row, created: count === 1 };
	}
}
