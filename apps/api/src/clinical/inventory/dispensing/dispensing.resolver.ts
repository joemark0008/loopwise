import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { type ClinicActor, CurrentClinicActor } from '../../clinics/clinic-admin-actor.js';
import { INVENTORY_DESKS } from '../inventory-access.js';
import { DispenseQueueService } from './dispense-queue.service.js';
import { DispensingService } from './dispensing.service.js';
import { DispensePrescriptionInput } from './dto/dispense.input.js';
import { DispenseQueueEntry } from './models/dispense.model.js';

/** Pharmacy → Dispense: the clinic's issued prescriptions and dispensing them (pharmacists and assistants). */
@Resolver(() => DispenseQueueEntry)
export class DispensingResolver {
	constructor(
		private readonly queue: DispenseQueueService,
		private readonly dispensing: DispensingService,
	) {}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.pharmacy })
	@Query(() => [DispenseQueueEntry], {
		description: "The selected clinic's issued prescriptions still to dispense, oldest first.",
	})
	dispenseQueue(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('includeDone', { defaultValue: false, description: 'Also those dispensed in the last 7 days.' })
		includeDone: boolean,
	): Promise<DispenseQueueEntry[]> {
		return this.queue.queue(actor, includeDone);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.pharmacy })
	@Query(() => DispenseQueueEntry, { description: 'An issued prescription with the stock that can fill it.' })
	prescriptionToDispense(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('prescriptionId', { type: () => ID }) prescriptionId: string,
	): Promise<DispenseQueueEntry> {
		return this.queue.get(actor, prescriptionId);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.pharmacy })
	@Mutation(() => DispenseQueueEntry, {
		description: 'Dispenses medicines of an issued prescription (DISPENSE movements, audited).',
	})
	dispensePrescription(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: DispensePrescriptionInput,
	): Promise<DispenseQueueEntry> {
		return this.dispensing.dispense(actor, input);
	}
}
