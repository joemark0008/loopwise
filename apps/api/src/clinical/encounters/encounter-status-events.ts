import { Injectable, Logger } from '@nestjs/common';

import type { ClinicalTx } from '../rls/clinical-db.service.js';
import type { EncounterStatus } from './encounters.enums.js';

/**
 * What moved a visit's status: the encounter page (or Wise, or any caller of `EncounterService.transition`), or the
 * queue pages, which move the ticket and the booking themselves (`VisitFlowService`).
 */
export type EncounterStatusTrigger = 'encounter' | 'queue';

/** A visit moved along its status machine (DESIGN.md §5.4). */
export interface EncounterStatusChanged {
	encounterId: string;
	patientId: string;
	clinicId: string;
	organizationId: string;
	appointmentId: string | null;
	practitionerId: string | null;
	from: EncounterStatus;
	to: EncounterStatus;
	/** Who moved it: the audit rows of whatever follows name them. */
	userId: string;
	reason: string | null;
	trigger: EncounterStatusTrigger;
}

/** Runs on the transaction that moved the visit, so what it changes commits or rolls back with the move. */
export type EncounterStatusListener = (tx: ClinicalTx, event: EncounterStatusChanged) => Promise<void>;

/**
 * The encounter-status domain event. `EncounterService.transition` publishes it inside the transaction that moved the
 * visit (after its audit row); modules that keep something in step with the visit subscribe on start-up. Scheduling's
 * `VisitStatusSync` moves the queue ticket and the booking this way, which keeps the dependency one-way: scheduling
 * imports encounters, encounters never imports scheduling. A listener that throws rolls the move back.
 */
@Injectable()
export class EncounterStatusEvents {
	private readonly logger = new Logger(EncounterStatusEvents.name);
	private readonly listeners: EncounterStatusListener[] = [];

	/** Adds a listener; returns the function that removes it. */
	subscribe(listener: EncounterStatusListener): () => void {
		this.listeners.push(listener);
		return () => {
			const index = this.listeners.indexOf(listener);
			if (index >= 0) {
				this.listeners.splice(index, 1);
			}
		};
	}

	/** Runs every listener in turn on the caller's transaction. */
	async publish(tx: ClinicalTx, event: EncounterStatusChanged): Promise<void> {
		this.logger.log(`Encounter ${event.encounterId} ${event.from} → ${event.to} (${event.trigger})`);
		for (const listener of this.listeners) {
			await listener(tx, event);
		}
	}
}
