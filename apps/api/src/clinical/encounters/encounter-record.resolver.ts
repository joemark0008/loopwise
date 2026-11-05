import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import {
	AddDiagnosisInput,
	RecordVitalsInput,
	UpdateDiagnosisInput,
	UpdateEncounterNoteInput,
	VoidEntryInput,
} from './dto/encounter-record.input.js';
import { EncounterDiagnosisService } from './encounter-diagnosis.service.js';
import { EncounterNoteService } from './encounter-note.service.js';
import { EncounterRecordService } from './encounter-record.service.js';
import { Encounter } from './models/encounter.model.js';
import { EncounterDiagnosis, EncounterRecord, PatientOverview, VitalSigns } from './models/encounter-record.model.js';
import { VitalSignsService } from './vital-signs.service.js';

/** The encounter record: its note, vitals and diagnoses. Access is row-level security plus the clinic checks. */
@Resolver(() => EncounterRecord)
export class EncounterRecordResolver {
	constructor(
		private readonly records: EncounterRecordService,
		private readonly notes: EncounterNoteService,
		private readonly vitals: VitalSignsService,
		private readonly diagnoses: EncounterDiagnosisService,
	) {}

	@Query(() => EncounterRecord, { nullable: true, description: 'Null when the encounter is not in your care.' })
	encounterRecord(
		@CurrentUser() user: AuthUser,
		@Args('encounterId', { type: () => ID }) encounterId: string,
	): Promise<EncounterRecord | null> {
		return this.records.get(user.id, encounterId);
	}

	@Query(() => PatientOverview, { description: "The patient chart's overview: the recent visits." })
	patientOverview(
		@CurrentUser() user: AuthUser,
		@Args('patientId', { type: () => ID }) patientId: string,
	): Promise<PatientOverview> {
		return this.records.getPatientOverview(user.id, patientId);
	}

	@Mutation(() => Encounter)
	updateEncounterNote(
		@CurrentUser() user: AuthUser,
		@Args('input') input: UpdateEncounterNoteInput,
	): Promise<Encounter> {
		return this.notes.update(user.id, input);
	}

	@Mutation(() => VitalSigns)
	recordVitals(@CurrentUser() user: AuthUser, @Args('input') input: RecordVitalsInput): Promise<VitalSigns> {
		return this.vitals.record(user.id, input);
	}

	@Mutation(() => VitalSigns)
	voidVitals(@CurrentUser() user: AuthUser, @Args('input') input: VoidEntryInput): Promise<VitalSigns> {
		return this.vitals.void(user.id, input);
	}

	@Mutation(() => EncounterDiagnosis)
	addDiagnosis(@CurrentUser() user: AuthUser, @Args('input') input: AddDiagnosisInput): Promise<EncounterDiagnosis> {
		return this.diagnoses.add(user.id, input);
	}

	@Mutation(() => EncounterDiagnosis)
	updateDiagnosis(
		@CurrentUser() user: AuthUser,
		@Args('input') input: UpdateDiagnosisInput,
	): Promise<EncounterDiagnosis> {
		return this.diagnoses.update(user.id, input);
	}

	@Mutation(() => EncounterDiagnosis)
	voidDiagnosis(@CurrentUser() user: AuthUser, @Args('input') input: VoidEntryInput): Promise<EncounterDiagnosis> {
		return this.diagnoses.void(user.id, input);
	}
}
