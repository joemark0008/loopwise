import { parsePathwayDefinition } from '@quarry/shared/pathway-rules';
import { RulesEngine } from '@quarry/shared/rules-engine';

import { PATHWAY_DEFINITIONS, type PathwayDefinitionKey } from '../src/clinical/pathways/pathway-definitions.js';
import { toEvaluationRow, toRuleInput } from '../src/clinical/pathways/rules.service.js';
import type { Prisma } from '../src/generated/prisma/client.js';

/**
 * Creates the pathways, or replaces a stored one whose version is older. Idempotent, and separate from the clinical
 * demo so a database seeded before the rules schema gets the new definitions. Returns the ids by key.
 */
export async function seedPathways(tx: Prisma.TransactionClient): Promise<Record<PathwayDefinitionKey, string>> {
	const ids = {} as Record<PathwayDefinitionKey, string>;
	for (const input of PATHWAY_DEFINITIONS) {
		const { key, name, version, rules, steps, slas, closureRequirements } = parsePathwayDefinition(input);
		const data = { name, version, rules, steps, slas, closureRequirements };
		const stored = await tx.pathway.findUnique({ where: { key }, select: { id: true, version: true } });
		if (!stored) {
			ids[key as PathwayDefinitionKey] = (await tx.pathway.create({ data: { key, ...data } })).id;
			continue;
		}
		if (stored.version < version) {
			await tx.pathway.update({ where: { id: stored.id }, data });
		}
		ids[key as PathwayDefinitionKey] = stored.id;
	}
	return ids;
}

/**
 * Stores an evaluation for every result that has none for its pathway's current version, with the same engine and
 * row as the `result.received` subscriber, so the seeded results show why they are actionable. Idempotent.
 */
export async function seedResultEvaluations(tx: Prisma.TransactionClient): Promise<number> {
	const pathways = (await tx.pathway.findMany({ where: { active: true } })).map(parsePathwayDefinition);
	const results = await tx.result.findMany();
	let stored = 0;
	for (const result of results) {
		const evaluation = RulesEngine.evaluate(toRuleInput(result), pathways);
		if (evaluation) {
			const { count } = await tx.resultEvaluation.createMany({
				data: [toEvaluationRow(result.id, evaluation)],
				skipDuplicates: true,
			});
			stored += count;
		}
	}
	return stored;
}
