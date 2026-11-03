import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { Loaders } from '../../common/dataloader/loaders.decorator.js';
import type { RequestLoaders } from '../../common/dataloader/request-loaders.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import {
	LinkExistingPatientInput,
	PatientDraftInput,
	RegisterPatientInput,
	SearchPatientsInput,
	UpdatePatientInput,
} from './dto/patient.input.js';
import {
	Facility,
	Patient,
	PatientDuplicate,
	PatientIdentifier,
	RegisterPatientPayload,
} from './models/patient.model.js';
import { FacilityLoader } from './patient.loader.js';
import { PatientService } from './patient.service.js';

/** Patient registration and lookup. Access is row-level security plus the facility checks in `PatientService`. */
@Resolver(() => Patient)
export class PatientsResolver {
	constructor(private readonly patients: PatientService) {}

	@Query(() => [Facility], { description: 'The facilities the signed-in user works at.' })
	myFacilities(@CurrentUser() user: AuthUser): Promise<Facility[]> {
		return this.patients.myFacilities(user.id);
	}

	@Query(() => [Patient], { description: 'Patients the user may see, by name words, identifier or birth date.' })
	searchPatients(@CurrentUser() user: AuthUser, @Args('input') input: SearchPatientsInput): Promise<Patient[]> {
		return this.patients.search(user.id, input);
	}

	@Query(() => Patient, { nullable: true, description: 'Null when the user may not see the patient.' })
	patient(@CurrentUser() user: AuthUser, @Args('id', { type: () => ID }) id: string): Promise<Patient | null> {
		return this.patients.getById(user.id, id);
	}

	@Query(() => ID, { nullable: true, description: "Your Wise chat about the patient (the chart's Ask Wise panel)." })
	patientChat(
		@CurrentUser() user: AuthUser,
		@Args('patientId', { type: () => ID }) patientId: string,
	): Promise<string | null> {
		return this.patients.chatIdFor(user.id, patientId);
	}

	@Query(() => [PatientDuplicate], { description: 'Existing patients a registration would duplicate.' })
	checkPatientDuplicates(
		@CurrentUser() user: AuthUser,
		@Args('input') input: PatientDraftInput,
	): Promise<PatientDuplicate[]> {
		return this.patients.checkDuplicates(user.id, input);
	}

	@Mutation(() => RegisterPatientPayload, {
		description: 'Registers a patient at the facility, unless duplicates stop it (then `patient` is null).',
	})
	registerPatient(
		@CurrentUser() user: AuthUser,
		@Args('input') input: RegisterPatientInput,
	): Promise<RegisterPatientPayload> {
		return this.patients.register(user.id, input);
	}

	@Mutation(() => Patient, { description: "Changes a patient's contact details (phone, language, barangay)." })
	updatePatient(@CurrentUser() user: AuthUser, @Args('input') input: UpdatePatientInput): Promise<Patient> {
		return this.patients.updateContact(user.id, input);
	}

	@Mutation(() => Patient, { description: 'Uses a matched existing patient at this facility instead of a new one.' })
	linkExistingPatient(
		@CurrentUser() user: AuthUser,
		@Args('input') input: LinkExistingPatientInput,
	): Promise<Patient> {
		return this.patients.linkExisting(user.id, input);
	}
}

@Resolver(() => PatientIdentifier)
export class PatientIdentifierResolver {
	@ResolveField(() => Facility, { nullable: true })
	facility(@Parent() identifier: PatientIdentifier, @Loaders() loaders: RequestLoaders): Promise<Facility | null> {
		return loaders.get(FacilityLoader).load(identifier.orgId);
	}
}
