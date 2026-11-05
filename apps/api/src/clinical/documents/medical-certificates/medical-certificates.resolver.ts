import { Injectable } from '@nestjs/common';
import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../../auth/auth.service.js';
import { Loaders } from '../../../common/dataloader/loaders.decorator.js';
import type { RequestLoaders } from '../../../common/dataloader/request-loaders.js';
import { CurrentUser } from '../../../common/decorators/current.decorator.js';
import { VoidEntryInput } from '../../encounters/dto/encounter-record.input.js';
import { groupByEncounter, userEncounterKey, UserEncounterLoader } from '../../encounters/encounter-child.loader.js';
import { EncounterRecord } from '../../encounters/models/encounter-record.model.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';
import { SaveMedicalCertificateInput } from './dto/medical-certificate.input.js';
import { MedicalCertificateService } from './medical-certificate.service.js';
import { MedicalCertificate } from './models/medical-certificate.model.js';

/** Medical certificates. Access is row-level security plus the clinic check of the visit. */
@Resolver(() => MedicalCertificate)
export class MedicalCertificatesResolver {
	constructor(private readonly service: MedicalCertificateService) {}

	@Query(() => MedicalCertificate, {
		nullable: true,
		description: 'For printing (audited); null when not in your care.',
	})
	medicalCertificate(
		@CurrentUser() user: AuthUser,
		@Args('id', { type: () => ID }) id: string,
	): Promise<MedicalCertificate | null> {
		return this.service.getForPrint(user.id, id);
	}

	@Mutation(() => MedicalCertificate, { description: 'Creates a draft, or replaces the draft `id`.' })
	saveMedicalCertificate(
		@CurrentUser() user: AuthUser,
		@Args('input') input: SaveMedicalCertificateInput,
	): Promise<MedicalCertificate> {
		return this.service.save(user.id, input);
	}

	@Mutation(() => MedicalCertificate, { description: 'Issues (signs) the draft as you; it is locked from then on.' })
	issueMedicalCertificate(
		@CurrentUser() user: AuthUser,
		@Args('id', { type: () => ID }) id: string,
		@Args('wiseOrigin', { type: () => WiseOriginInput, nullable: true }) wiseOrigin?: WiseOriginInput | null,
	): Promise<MedicalCertificate> {
		return this.service.issue(user.id, id, wiseOrigin);
	}

	@Mutation(() => MedicalCertificate, { description: 'Voids the certificate; it stays in the record, marked void.' })
	voidMedicalCertificate(
		@CurrentUser() user: AuthUser,
		@Args('input') input: VoidEntryInput,
	): Promise<MedicalCertificate> {
		return this.service.void(user.id, input);
	}
}

/** The certificates of each encounter, as the user, one query per request. */
@Injectable()
export class EncounterCertificatesLoader extends UserEncounterLoader<MedicalCertificate> {
	constructor(
		db: ClinicalDbService,
		private readonly certificates: MedicalCertificateService,
	) {
		super(db);
	}

	protected async load(tx: ClinicalTx, encounterIds: readonly string[]): Promise<Map<string, MedicalCertificate[]>> {
		return groupByEncounter(
			await this.certificates.listForEncounters(tx, encounterIds),
			(certificate) => certificate.encounterId,
		);
	}
}

/** The certificates of an encounter's record. */
@Resolver(() => EncounterRecord)
export class EncounterRecordCertificatesResolver {
	@ResolveField(() => [MedicalCertificate], { description: 'Newest first, voided included.' })
	async medicalCertificates(
		@Parent() record: EncounterRecord,
		@CurrentUser() user: AuthUser,
		@Loaders() loaders: RequestLoaders,
	): Promise<MedicalCertificate[]> {
		return (
			(await loaders.get(EncounterCertificatesLoader).load(userEncounterKey(user.id, record.encounter.id))) ?? []
		);
	}
}
