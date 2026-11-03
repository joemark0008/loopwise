import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import {
	AddAllergyInput,
	AddDiagnosisInput,
	RecordVitalsInput,
	UpdateDiagnosisInput,
	UpdateEncounterNoteInput,
	VoidAllergyInput,
	VoidEntryInput,
} from './dto/encounter-record.input.js';
import { EncounterRecordService } from './encounter-record.service.js';
import { Encounter } from './models/encounter.model.js';
import {
	EncounterDiagnosis,
	EncounterRecord,
	Icd10Code,
	PatientAllergy,
	VitalSigns,
} from './models/encounter-record.model.js';
import { PatientOverview } from './models/patient-overview.model.js';

/** The encounter record. Access is row-level security plus the facility check in `EncounterRecordService`. */
@Resolver(() => EncounterRecord)
export class EncounterRecordResolver {
	constructor(private readonly service: EncounterRecordService) {}

	@Query(() => EncounterRecord, { nullable: true, description: 'Null when the encounter is not in your care.' })
	encounterRecord(
		@CurrentUser() user: AuthUser,
		@Args('encounterId', { type: () => ID }) encounterId: string,
	): Promise<EncounterRecord | null> {
		return this.service.get(user.id, encounterId);
	}

	@Query(() => PatientOverview, {
		description: "The patient chart's overview: recent visits, vitals, problems, medicines and results.",
	})
	patientOverview(
		@CurrentUser() user: AuthUser,
		@Args('patientId', { type: () => ID }) patientId: string,
	): Promise<PatientOverview> {
		return this.service.getPatientOverview(user.id, patientId);
	}

	@Query(() => [PatientAllergy], { description: "The patient's active allergies (empty if not in your care)." })
	patientAllergies(
		@CurrentUser() user: AuthUser,
		@Args('patientId', { type: () => ID }) patientId: string,
	): Promise<PatientAllergy[]> {
		return this.service.listAllergies(user.id, patientId);
	}

	@Query(() => [Icd10Code], { description: 'Common ICD-10 codes by code prefix or title words.' })
	searchIcd10(@Args('query') query: string): Icd10Code[] {
		return this.service.searchIcd10(query);
	}

	@Mutation(() => Encounter)
	updateEncounterNote(
		@CurrentUser() user: AuthUser,
		@Args('input') input: UpdateEncounterNoteInput,
	): Promise<Encounter> {
		return this.service.updateNote(user.id, input);
	}

	@Mutation(() => VitalSigns)
	recordVitals(@CurrentUser() user: AuthUser, @Args('input') input: RecordVitalsInput): Promise<VitalSigns> {
		return this.service.recordVitals(user.id, input);
	}

	@Mutation(() => VitalSigns)
	voidVitals(@CurrentUser() user: AuthUser, @Args('input') input: VoidEntryInput): Promise<VitalSigns> {
		return this.service.voidVitals(user.id, input);
	}

	@Mutation(() => EncounterDiagnosis)
	addDiagnosis(@CurrentUser() user: AuthUser, @Args('input') input: AddDiagnosisInput): Promise<EncounterDiagnosis> {
		return this.service.addDiagnosis(user.id, input);
	}

	@Mutation(() => EncounterDiagnosis)
	updateDiagnosis(
		@CurrentUser() user: AuthUser,
		@Args('input') input: UpdateDiagnosisInput,
	): Promise<EncounterDiagnosis> {
		return this.service.updateDiagnosis(user.id, input);
	}

	@Mutation(() => EncounterDiagnosis)
	voidDiagnosis(@CurrentUser() user: AuthUser, @Args('input') input: VoidEntryInput): Promise<EncounterDiagnosis> {
		return this.service.voidDiagnosis(user.id, input);
	}

	@Mutation(() => PatientAllergy)
	addAllergy(@CurrentUser() user: AuthUser, @Args('input') input: AddAllergyInput): Promise<PatientAllergy> {
		return this.service.addAllergy(user.id, input);
	}

	@Mutation(() => PatientAllergy)
	voidAllergy(@CurrentUser() user: AuthUser, @Args('input') input: VoidAllergyInput): Promise<PatientAllergy> {
		return this.service.voidAllergy(user.id, input);
	}
}
