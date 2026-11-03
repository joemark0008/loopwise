import { Injectable } from '@nestjs/common';

import type { ClinicianProfile as ClinicianProfileRow } from '../../generated/prisma/client.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { ClinicianRepository } from './clinician.repository.js';
import type { UpdateClinicianProfileInput } from './dto/clinician-profile.input.js';
import type { ClinicianProfile } from './models/clinician-profile.model.js';

const EMPTY: ClinicianProfile = { credentials: null, specialty: null, prcLicenseNumber: null, ptrNumber: null };

/** The signed-in clinician's own profile; prescriptions and certificates print it (row-level security: own rows). */
@Injectable()
export class ClinicianService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly clinicians: ClinicianRepository,
	) {}

	myProfile(userId: string): Promise<ClinicianProfile> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.clinicians.getProfile(tx, userId);
			return row ? toProfile(row) : EMPTY;
		});
	}

	updateMyProfile(userId: string, input: UpdateClinicianProfileInput): Promise<ClinicianProfile> {
		const text = (value?: string | null) => value?.trim() || null;
		return this.db.asUser(userId, async (tx) =>
			toProfile(
				await this.clinicians.upsertProfile(tx, userId, {
					credentials: text(input.credentials),
					specialty: text(input.specialty),
					prcLicenseNumber: text(input.prcLicenseNumber),
					ptrNumber: text(input.ptrNumber),
				}),
			),
		);
	}
}

function toProfile(row: ClinicianProfileRow): ClinicianProfile {
	return {
		credentials: row.credentials,
		specialty: row.specialty,
		prcLicenseNumber: row.prcLicenseNumber,
		ptrNumber: row.ptrNumber,
	};
}
