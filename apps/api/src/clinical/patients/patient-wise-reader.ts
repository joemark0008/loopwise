import { Injectable } from '@nestjs/common';

import type { PatientDraftInput, SearchPatientsInput } from './dto/patient.input.js';
import type { ClinicRef } from './models/clinic-ref.model.js';
import type { Patient, PatientDuplicate } from './models/patient.model.js';
import { PatientService } from './patient.service.js';
import { PatientRegistrationService } from './patient-registration.service.js';

/**
 * What Wise's tools may read about patients (`AgentToolServices['patients']`, provided as `PATIENT_READER`): reads
 * only, as the user, audited by the services behind them. Registering stays the user's own mutation, from the card.
 */
@Injectable()
export class PatientWiseReader {
	constructor(
		private readonly patients: PatientService,
		private readonly registration: PatientRegistrationService,
	) {}

	/** The clinics where the user registers patients and records visits. */
	myCareClinics(userId: string): Promise<ClinicRef[]> {
		return this.patients.myCareClinics(userId);
	}

	isVisible(userId: string, patientId: string): Promise<boolean> {
		return this.patients.isVisible(userId, patientId);
	}

	getChartSummary(userId: string, patientId: string): Promise<string | null> {
		return this.patients.getChartSummary(userId, patientId);
	}

	/** `find_patient`: the search as the user, every patient shown audited as a view. */
	findForWise(
		userId: string,
		input: SearchPatientsInput,
		limit: number,
	): Promise<{ patients: Patient[]; truncated: boolean }> {
		return this.patients.findForWise(userId, input, limit);
	}

	/** `open_page`: the patient as the user (null when hidden), audited with `reason`. */
	getById(userId: string, patientId: string, reason?: string): Promise<Patient | null> {
		return this.patients.getById(userId, patientId, reason);
	}

	/** `propose_patient_registration`: the organization's patients the draft would duplicate, masked. */
	checkDuplicates(userId: string, draft: PatientDraftInput): Promise<PatientDuplicate[]> {
		return this.registration.checkDuplicates(userId, draft);
	}
}
