import { describeNumericBand, type PathwayDefinition, stepSlaHours } from '@quarry/shared/pathway-rules';

import type { Pathway } from './models/pathway.model.js';

/** A validated definition as the read-only GraphQL `Pathway`: every band labelled and with its effective SLA. */
export function toPathwayView(pathway: PathwayDefinition): Pathway {
	return {
		key: pathway.key,
		name: pathway.name,
		version: pathway.version,
		source: pathway.rules.source,
		triggers: pathway.rules.triggers.map((trigger) => ({
			code: trigger.code,
			codeSystem: trigger.codeSystem,
			display: trigger.display,
			type: trigger.type,
			unit: trigger.type === 'numeric' ? trigger.unit : null,
			conversions:
				trigger.type === 'numeric'
					? trigger.conversions.map(({ from, factor, offset, note }) => ({
							from,
							factor,
							offset,
							note: note ?? null,
						}))
					: [],
			bands: trigger.bands.map((band) => ({
				label:
					'values' in band
						? band.values
								.map(
									(value) =>
										`${trigger.type === 'coded' && trigger.valueLabel ? `${trigger.valueLabel} ` : ''}${value}`,
								)
								.join(', ')
						: describeNumericBand(band, trigger.type === 'numeric' ? trigger.unit : ''),
				min: 'min' in band ? (band.min ?? null) : null,
				below: 'below' in band ? (band.below ?? null) : null,
				values: 'values' in band ? band.values : null,
				classification: band.classification,
				urgency: band.urgency,
				reason: band.reason,
				guideline: band.guideline,
				nextState: band.nextState,
				slaHours: band.slaHours ?? stepSlaHours(pathway, band.nextState) ?? null,
			})),
		})),
		steps: pathway.steps.map(({ state, label, slaHours }) => ({ state, label, slaHours: slaHours ?? null })),
		resultReviewHours: pathway.slas.resultReviewHours,
		criticalAlertHours: pathway.slas.criticalAlertHours,
		criticalFlagNextState: pathway.rules.criticalFlag.nextState,
		closureEvidence: pathway.closureRequirements.anyOf,
		closureDescription: pathway.closureRequirements.description,
	};
}
