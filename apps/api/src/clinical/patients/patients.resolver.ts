import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import {
	LinkExistingPatientInput,
	PatientDraftInput,
	RegisterPatientInput,
	SearchPatientsInput,
	UpdatePatientInput,
} from './dto/patient.input.js';
import { AddAllergyInput, VoidAllergyInput } from './dto/patient-allergy.input.js';
import { ClinicRef } from './models/clinic-ref.model.js';
import { Patient, PatientDuplicate, RegisterPatientPayload } from './models/patient.model.js';
import { PatientAllergy } from './models/patient-allergy.model.js';
import { PatientService } from './patient.service.js';
import { PatientAllergyService } from './patient-allergy.service.js';
import { PatientRegistrationService } from './patient-registration.service.js';

/** Patient registration, lookup and contact details. Access is row-level security plus the clinic checks. */
@Resolver(() => Patient)
export class PatientsResolver {
	constructor(
		private readonly patients: PatientService,
		private readonly registration: PatientRegistrationService,
	) {}

	@Query(() => [ClinicRef], { description: 'The clinics where you register patients and record visits.' })
	myCareClinics(@CurrentUser() user: AuthUser): Promise<ClinicRef[]> {
		return this.patients.myCareClinics(user.id);
	}

	@Query(() => [Patient], { description: 'Patients you may see, by name words, patient no. / ID or birth date.' })
	searchPatients(@CurrentUser() user: AuthUser, @Args('input') input: SearchPatientsInput): Promise<Patient[]> {
		return this.patients.search(user.id, input);
	}

	@Query(() => Patient, { nullable: true, description: 'Null when you may not see the patient.' })
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

	@Query(() => [PatientDuplicate], { description: "The organization's patients a registration would duplicate." })
	checkPatientDuplicates(
		@CurrentUser() user: AuthUser,
		@Args('input') input: PatientDraftInput,
	): Promise<PatientDuplicate[]> {
		return this.registration.checkDuplicates(user.id, input);
	}

	@Mutation(() => RegisterPatientPayload, {
		description: 'Registers a patient at the clinic, unless duplicates stop it (then `patient` is null).',
	})
	registerPatient(
		@CurrentUser() user: AuthUser,
		@Args('input') input: RegisterPatientInput,
	): Promise<RegisterPatientPayload> {
		return this.registration.register(user.id, input);
	}

	@Mutation(() => Patient, { description: 'Uses a matched existing patient instead of registering a new one.' })
	linkExistingPatient(
		@CurrentUser() user: AuthUser,
		@Args('input') input: LinkExistingPatientInput,
	): Promise<Patient> {
		return this.registration.linkExisting(user.id, input);
	}

	@Mutation(() => Patient, { description: "Changes a patient's contact details (mobile, language, address)." })
	updatePatient(@CurrentUser() user: AuthUser, @Args('input') input: UpdatePatientInput): Promise<Patient> {
		return this.patients.updateContact(user.id, input);
	}
}

/** A patient's allergies. */
@Resolver(() => PatientAllergy)
export class PatientAllergiesResolver {
	constructor(private readonly allergies: PatientAllergyService) {}

	@Query(() => [PatientAllergy], { description: "The patient's active allergies (empty if not in your care)." })
	patientAllergies(
		@CurrentUser() user: AuthUser,
		@Args('patientId', { type: () => ID }) patientId: string,
	): Promise<PatientAllergy[]> {
		return this.allergies.list(user.id, patientId);
	}

	@Mutation(() => PatientAllergy)
	addAllergy(@CurrentUser() user: AuthUser, @Args('input') input: AddAllergyInput): Promise<PatientAllergy> {
		return this.allergies.add(user.id, input);
	}

	@Mutation(() => PatientAllergy)
	voidAllergy(@CurrentUser() user: AuthUser, @Args('input') input: VoidAllergyInput): Promise<PatientAllergy> {
		return this.allergies.void(user.id, input);
	}
}
