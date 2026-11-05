import { Injectable } from '@nestjs/common';
import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../../auth/auth.service.js';
import { Loaders } from '../../../common/dataloader/loaders.decorator.js';
import type { RequestLoaders } from '../../../common/dataloader/request-loaders.js';
import { CurrentUser } from '../../../common/decorators/current.decorator.js';
import { groupByEncounter, userEncounterKey, UserEncounterLoader } from '../../encounters/encounter-child.loader.js';
import { EncounterRecord } from '../../encounters/models/encounter-record.model.js';
import { Practitioner } from '../../practitioners/models/practitioner.model.js';
import { PractitionerLoader } from '../../practitioners/practitioner.loader.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { CancelReferralInput, CreateReferralInput } from './dto/referral.input.js';
import { Referral } from './models/referral.model.js';
import { ReferralService } from './referral.service.js';

/** Referrals from an encounter. Access is row-level security plus the clinic check of the visit. */
@Resolver(() => Referral)
export class ReferralsResolver {
	constructor(private readonly service: ReferralService) {}

	@Mutation(() => Referral, { description: 'Refers the patient of a visit (internal practitioner or outside).' })
	createReferral(@CurrentUser() user: AuthUser, @Args('input') input: CreateReferralInput): Promise<Referral> {
		return this.service.create(user.id, input);
	}

	@Mutation(() => Referral, { description: 'Cancels a referral not yet completed or declined.' })
	cancelReferral(@CurrentUser() user: AuthUser, @Args('input') input: CancelReferralInput): Promise<Referral> {
		return this.service.cancel(user.id, input);
	}

	@ResolveField(() => Practitioner, { nullable: true, description: 'The referring practitioner.' })
	fromPractitioner(@Parent() referral: Referral, @Loaders() loaders: RequestLoaders): Promise<Practitioner | null> {
		return loaders.get(PractitionerLoader).load(referral.fromPractitionerId);
	}

	@ResolveField(() => Practitioner, { nullable: true, description: 'The practitioner referred to (internal).' })
	toPractitioner(@Parent() referral: Referral, @Loaders() loaders: RequestLoaders): Promise<Practitioner | null> {
		return referral.toPractitionerId
			? loaders.get(PractitionerLoader).load(referral.toPractitionerId)
			: Promise.resolve(null);
	}
}

/** The referrals of each encounter, as the user, one query per request. */
@Injectable()
export class EncounterReferralsLoader extends UserEncounterLoader<Referral> {
	constructor(
		db: ClinicalDbService,
		private readonly referrals: ReferralService,
	) {
		super(db);
	}

	protected async load(tx: ClinicalTx, encounterIds: readonly string[]): Promise<Map<string, Referral[]>> {
		return groupByEncounter(await this.referrals.listForEncounters(tx, encounterIds), (row) => row.encounterId);
	}
}

/** The referrals of an encounter's record. */
@Resolver(() => EncounterRecord)
export class EncounterRecordReferralsResolver {
	@ResolveField(() => [Referral], { description: 'Newest first.' })
	async referrals(
		@Parent() record: EncounterRecord,
		@CurrentUser() user: AuthUser,
		@Loaders() loaders: RequestLoaders,
	): Promise<Referral[]> {
		return (await loaders.get(EncounterReferralsLoader).load(userEncounterKey(user.id, record.encounter.id))) ?? [];
	}
}
