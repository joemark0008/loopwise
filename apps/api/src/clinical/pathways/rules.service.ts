import { type RuleEvaluation, RulesEngine } from '@loopwise/shared/rules-engine';
import type { explainResult } from '@loopwise/shared/tools';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import type { Prisma, Result } from '../../generated/prisma/client.js';
import { ClinicalAuditRepository } from '../audit/clinical-audit.repository.js';
import { ClinicalEventsService } from '../events/clinical-events.service.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { ResultEvaluation } from './models/result-evaluation.model.js';
import { PathwayRepository, type ResultEvaluationRow } from './pathway.repository.js';
import { PathwaysService } from './pathways.service.js';

/** What `evaluateAndStore` returns: the evaluation and the stored row's id. */
export interface ResultEvaluated {
	resultId: string;
	patientId: string;
	evaluationId: string;
	evaluation: RuleEvaluation;
}

/**
 * The rules engine's service (DESIGN.md §4.2 "actionable? urgency?", §4.3 step 3): loads a result, evaluates it with
 * the pure `RulesEngine` against the active pathways, and stores why. Deterministic; no AI decides anything here.
 */
@Injectable()
export class RulesService {
	private readonly logger = new Logger(RulesService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly repository: PathwayRepository,
		private readonly pathways: PathwaysService,
		private readonly audit: ClinicalAuditRepository,
		private readonly events: ClinicalEventsService,
	) {}

	/** Evaluates a stored result without saving anything (system work). Null when no pathway applies. */
	async evaluateResult(resultId: string): Promise<RuleEvaluation | null> {
		const result = await this.db.asSystem((tx) => this.repository.findResult(tx, resultId));
		if (!result) {
			throw new NotFoundException(`Result ${resultId} not found`);
		}
		return RulesEngine.evaluate(toRuleInput(result), await this.pathways.active());
	}

	/**
	 * Evaluates a result and stores the evaluation once per rule version (system work): the `result.received`
	 * subscriber. Returns null when no pathway applies.
	 */
	async evaluateAndStore(resultId: string): Promise<ResultEvaluated | null> {
		const result = await this.db.asSystem((tx) => this.repository.findResult(tx, resultId));
		if (!result) {
			throw new NotFoundException(`Result ${resultId} not found`);
		}
		const evaluation = RulesEngine.evaluate(toRuleInput(result), await this.pathways.active());
		if (!evaluation) {
			return null;
		}
		const { row, created } = await this.db.asSystem((tx) =>
			this.repository.storeEvaluation(tx, toEvaluationRow(resultId, evaluation)),
		);
		if (created) {
			this.logger.log(
				`Result ${resultId}: ${evaluation.pathwayKey}@${evaluation.pathwayVersion} ${evaluation.classification}/${evaluation.urgency}`,
			);
		}
		if (created) {
			// TODO(follow-ups loop, PLAN.md §4.5): subscribe to `result.evaluated`; open or advance the CareCase
			// toward `nextState`, assign the owner and start the SLA timer (`slaHours`). A `critical` classification
			// goes to a clinician at once and never gets an automated patient message (§2).
			await this.events.emit('result.evaluated', {
				resultId,
				patientId: result.patientId,
				evaluationId: row.id,
				pathwayKey: evaluation.pathwayKey,
				ruleVersion: evaluation.pathwayVersion,
				classification: evaluation.classification,
				urgency: evaluation.urgency,
				nextState: evaluation.nextState,
				slaHours: evaluation.slaHours,
			});
		}
		return { resultId, patientId: result.patientId, evaluationId: row.id, evaluation };
	}

	/**
	 * The stored evaluation of a result, as the user: row-level security returns it only when the user can read the
	 * result. Audited as `result_evaluation.view`. Null when the result has no evaluation or the user can't see it.
	 */
	evaluationForUser(userId: string, resultId: string, reason?: string): Promise<ResultEvaluation | null> {
		return this.db.asUser(userId, async (tx) => {
			const result = await this.repository.findResult(tx, resultId);
			const row = result && (await this.repository.latestEvaluation(tx, resultId));
			if (!result || !row) {
				return null;
			}
			await this.audit.write(tx, {
				userId,
				orgId: null,
				patientId: result.patientId,
				action: 'result_evaluation.view',
				resource: 'result_evaluation',
				resourceId: row.id,
				reason: reason ?? null,
			});
			return toModel(row);
		});
	}

	/**
	 * The Wise `explain_result` read (DESIGN.md §7.2): the result and why it is (or isn't) actionable, as the user.
	 * Row-level security decides whether the user sees the result at all; the read is audited as
	 * `result_evaluation.view`. With no stored evaluation yet the same engine computes one for the answer. Wise only
	 * relays it; it never classifies.
	 */
	async explainForWise(userId: string, resultId: string): Promise<ResultExplanation> {
		const read = await this.db.asUser(userId, async (tx) => {
			const result = await this.repository.findResult(tx, resultId);
			if (!result) {
				return null;
			}
			const row = await this.repository.latestEvaluation(tx, resultId);
			await this.audit.write(tx, {
				userId,
				orgId: null,
				patientId: result.patientId,
				action: 'result_evaluation.view',
				resource: 'result',
				resourceId: result.id,
				reason: 'Wise explain_result',
			});
			return { result, row };
		});
		if (!read) {
			throw new NotFoundException('No result with this id that you may see.');
		}
		const { result, row } = read;
		let evaluation: explainResult.Evaluation | null = row ? explanation(row) : null;
		if (!evaluation) {
			const pathways = await this.pathways.active();
			const computed = RulesEngine.evaluate(toRuleInput(result), pathways);
			const pathwayName = pathways.find((pathway) => pathway.key === computed?.pathwayKey)?.name;
			evaluation = computed && {
				pathwayKey: computed.pathwayKey,
				pathwayName: pathwayName ?? computed.pathwayKey,
				ruleVersion: computed.pathwayVersion,
				classification: computed.classification,
				urgency: computed.urgency,
				reason: computed.reason,
				guideline: computed.guideline,
				nextState: computed.nextState,
				slaHours: computed.slaHours,
				basis: computed.basis,
				rule: computed.rule,
				stored: false,
			};
		}
		return {
			result: {
				id: result.id,
				patientId: result.patientId,
				display: result.display ?? result.code,
				value: result.value,
				unit: result.unit,
				flag: result.flag,
				resultedAt: result.resultedAt.toISOString(),
			},
			evaluation,
		};
	}
}

/** The `result_evaluation` row of an evaluation; shared with the seed's backfill. */
/** `RulesService.explainForWise`, minus the tool output's version. */
export type ResultExplanation = Omit<explainResult.Output, '_version'>;

export function toEvaluationRow(
	resultId: string,
	evaluation: RuleEvaluation,
): Prisma.ResultEvaluationUncheckedCreateInput {
	return {
		resultId,
		pathwayKey: evaluation.pathwayKey,
		ruleVersion: evaluation.pathwayVersion,
		classification: evaluation.classification,
		urgency: evaluation.urgency,
		reason: evaluation.reason,
		guideline: evaluation.guideline,
		nextState: evaluation.nextState,
		slaHours: evaluation.slaHours,
		basis: evaluation.basis,
		rule: evaluation.rule,
	};
}

function explanation(row: ResultEvaluationRow): explainResult.Evaluation {
	return { ...toModel(row), basis: row.basis as explainResult.Evaluation['basis'], stored: true };
}

export function toRuleInput(result: Result) {
	return {
		code: result.code,
		codeSystem: result.codeSystem,
		value: result.value,
		valueNumeric: result.valueNumeric === null ? null : Number(result.valueNumeric),
		unit: result.unit,
		flag: result.flag,
	};
}

function toModel(row: ResultEvaluationRow): ResultEvaluation {
	return {
		id: row.id,
		resultId: row.resultId,
		pathwayKey: row.pathwayKey,
		pathwayName: row.pathway.name,
		ruleVersion: row.ruleVersion,
		classification: row.classification,
		urgency: row.urgency,
		reason: row.reason,
		guideline: row.guideline,
		nextState: row.nextState,
		slaHours: row.slaHours,
		basis: row.basis,
		rule: row.rule as unknown as RuleEvaluation['rule'],
		evaluatedAt: row.evaluatedAt,
	};
}
