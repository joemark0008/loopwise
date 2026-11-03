import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { VoidEntryInput } from '../encounters/dto/encounter-record.input.js';
import { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { SavePrescriptionInput } from './dto/prescription.input.js';
import { Prescription } from './models/prescription.model.js';
import { PrescriptionService } from './prescription.service.js';

/** Prescriptions. Access is row-level security plus the facility check in `PrescriptionService`. */
@Resolver(() => Prescription)
export class PrescriptionsResolver {
	constructor(private readonly service: PrescriptionService) {}

	@Query(() => Prescription, { nullable: true, description: 'For printing; null when not in your care.' })
	prescription(
		@CurrentUser() user: AuthUser,
		@Args('id', { type: () => ID }) id: string,
	): Promise<Prescription | null> {
		return this.service.get(user.id, id);
	}

	@Mutation(() => Prescription, { description: 'Creates a draft, or replaces the draft `id`.' })
	savePrescription(
		@CurrentUser() user: AuthUser,
		@Args('input') input: SavePrescriptionInput,
	): Promise<Prescription> {
		return this.service.save(user.id, input);
	}

	@Mutation(() => Prescription, { description: 'Issues the draft as you; it is locked from then on.' })
	issuePrescription(
		@CurrentUser() user: AuthUser,
		@Args('id', { type: () => ID }) id: string,
		@Args('overrideAllergyWarning', { type: () => Boolean, defaultValue: false }) overrideAllergyWarning: boolean,
		@Args('wiseOrigin', { type: () => WiseOriginInput, nullable: true }) wiseOrigin?: WiseOriginInput | null,
	): Promise<Prescription> {
		return this.service.issue(user.id, id, overrideAllergyWarning, wiseOrigin);
	}

	@Mutation(() => Prescription)
	voidPrescription(@CurrentUser() user: AuthUser, @Args('input') input: VoidEntryInput): Promise<Prescription> {
		return this.service.void(user.id, input);
	}
}
