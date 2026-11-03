import { Injectable, Logger } from '@nestjs/common';

/**
 * The in-process clinical events (DESIGN.md §6.3). Ingest publishes, the rules and case engines subscribe. A small
 * typed bus for the prototype; NATS JetStream can replace it behind the same names.
 */
export interface ClinicalEvents {
	/** A result was stored (HL7 ORU or a web screen). `orderId` is null for results with no Loopwise order. */
	'result.received': { resultId: string; patientId: string; orderId: string | null };
	/**
	 * The rules engine stored an evaluation of a result (`RulesService.evaluateAndStore`): its classification, urgency
	 * and the case state to aim for. Published once per result and rule version. The case engine subscribes.
	 */
	'result.evaluated': {
		resultId: string;
		patientId: string;
		evaluationId: string;
		pathwayKey: string;
		ruleVersion: number;
		classification: 'normal' | 'actionable' | 'critical';
		urgency: 'routine' | 'soon' | 'urgent' | 'critical';
		nextState: string;
		slaHours: number | null;
	};
}

export type ClinicalEventName = keyof ClinicalEvents;
export type ClinicalEventHandler<K extends ClinicalEventName> = (payload: ClinicalEvents[K]) => void | Promise<void>;

@Injectable()
export class ClinicalEventsService {
	private readonly logger = new Logger(ClinicalEventsService.name);
	private readonly handlers = new Map<ClinicalEventName, Set<ClinicalEventHandler<ClinicalEventName>>>();

	/** Subscribes; returns the unsubscribe function. */
	on<K extends ClinicalEventName>(name: K, handler: ClinicalEventHandler<K>): () => void {
		const set = this.handlers.get(name) ?? new Set();
		set.add(handler as ClinicalEventHandler<ClinicalEventName>);
		this.handlers.set(name, set);
		return () => set.delete(handler as ClinicalEventHandler<ClinicalEventName>);
	}

	/**
	 * Calls every handler and waits for them. Publish after the transaction commits: a handler failure is logged, never
	 * thrown back, so it cannot undo or fail the work that raised the event.
	 */
	async emit<K extends ClinicalEventName>(name: K, payload: ClinicalEvents[K]): Promise<void> {
		const handlers = [...(this.handlers.get(name) ?? [])];
		const outcomes = await Promise.allSettled(handlers.map(async (handler) => handler(payload)));
		for (const outcome of outcomes) {
			if (outcome.status === 'rejected') {
				this.logger.error(
					`A ${name} handler failed`,
					outcome.reason instanceof Error ? outcome.reason.stack : outcome.reason,
				);
			}
		}
	}
}
