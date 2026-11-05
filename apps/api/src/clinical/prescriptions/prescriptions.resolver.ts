import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { Loaders } from '../../common/dataloader/loaders.decorator.js';
import type { RequestLoaders } from '../../common/dataloader/request-loaders.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { VoidEntryInput } from '../encounters/dto/encounter-record.input.js';
import { userEncounterKey } from '../encounters/encounter-child.loader.js';
import { EncounterRecord, PatientVisit } from '../encounters/models/encounter-record.model.js';
import { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { SavePrescriptionInput } from './dto/prescription.input.js';
import { Prescription } from './models/prescription.model.js';
import { EncounterPrescriptionsLoader } from './prescription.loader.js';
import { PrescriptionService } from './prescription.service.js';

/** Prescriptions. Access is row-level security plus the clinic check of the visit. */
@Resolver(() => Prescription)
export class PrescriptionsResolver {
	constructor(private readonly service: PrescriptionService) {}

	@Query(() => Prescription, { nullable: true, description: 'For printing (audited); null when not in your care.' })
	prescription(
		@CurrentUser() user: AuthUser,
		@Args('id', { type: () => ID }) id: string,
	): Promise<Prescription | null> {
		return this.service.getForPrint(user.id, id);
	}

	@Mutation(() => Prescription, { description: 'Creates a draft, or replaces the draft `id`.' })
	savePrescription(
		@CurrentUser() user: AuthUser,
		@Args('input') input: SavePrescriptionInput,
	): Promise<Prescription> {
		return this.service.save(user.id, input);
	}

	@Mutation(() => Prescription, { description: 'Issues (signs) the draft as you; it is locked from then on.' })
	issuePrescription(
		@CurrentUser() user: AuthUser,
		@Args('id', { type: () => ID }) id: string,
		@Args('overrideAllergyWarning', { type: () => Boolean, defaultValue: false }) overrideAllergyWarning: boolean,
		@Args('wiseOrigin', { type: () => WiseOriginInput, nullable: true }) wiseOrigin?: WiseOriginInput | null,
	): Promise<Prescription> {
		return this.service.issue(user.id, id, overrideAllergyWarning, wiseOrigin);
	}

	@Mutation(() => Prescription, { description: 'Voids the prescription (status CANCELLED); it stays in the record.' })
	voidPrescription(@CurrentUser() user: AuthUser, @Args('input') input: VoidEntryInput): Promise<Prescription> {
		return this.service.void(user.id, input);
	}
}

/** The prescriptions of an encounter's record. */
@Resolver(() => EncounterRecord)
export class EncounterRecordPrescriptionsResolver {
	@ResolveField(() => [Prescription], { description: 'Newest first, voided included.' })
	async prescriptions(
		@Parent() record: EncounterRecord,
		@CurrentUser() user: AuthUser,
		@Loaders() loaders: RequestLoaders,
	): Promise<Prescription[]> {
		return (
			(await loaders.get(EncounterPrescriptionsLoader).load(userEncounterKey(user.id, record.encounter.id))) ?? []
		);
	}
}

/** The prescriptions of a visit of the chart's list. */
@Resolver(() => PatientVisit)
export class PatientVisitPrescriptionsResolver {
	@ResolveField(() => [Prescription], { description: 'Not voided, newest first.' })
	async prescriptions(
		@Parent() visit: PatientVisit,
		@CurrentUser() user: AuthUser,
		@Loaders() loaders: RequestLoaders,
	): Promise<Prescription[]> {
		const all = await loaders.get(EncounterPrescriptionsLoader).load(userEncounterKey(user.id, visit.encounter.id));
		return (all ?? []).filter((prescription) => prescription.voidedAt === null);
	}
}
