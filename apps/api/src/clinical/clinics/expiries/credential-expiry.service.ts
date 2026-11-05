import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { dateOnly } from '../../../common/input-values.js';
import { PractitionerService } from '../../practitioners/practitioner.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import type { ClinicActor } from '../clinic-admin-actor.js';
import { ClinicProfileRepository } from '../profile/clinic-profile.repository.js';
import { type Credential, expiringCredentials, EXPIRY_WARNING_DAYS } from './credential-expiry.js';
import { credentialLabel, type ExpiringCredential } from './models/expiring-credential.model.js';

/**
 * The licenses and accreditations of the selected clinic that expire within the warning window (60 days by
 * default): the clinic's DOH License to Operate and PhilHealth accreditation, and the PRC license, S2 license and
 * PhilHealth PAN of the practitioners who hold clinic there. Read as the user.
 */
@Injectable()
export class CredentialExpiryService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly profiles: ClinicProfileRepository,
		private readonly practitioners: PractitionerService,
	) {}

	async list(
		actor: ClinicActor,
		withinDays: number = EXPIRY_WARNING_DAYS,
		now: Date = new Date(),
	): Promise<ExpiringCredential[]> {
		const clinic = await this.db.asUser(actor.userId, (tx) => this.profiles.findProfile(tx, actor.clinicId));
		if (!clinic) {
			throw new EntityNotFoundError('Clinic', actor.clinicId);
		}
		const practitioners = await this.practitioners.listAtClinic(actor.userId, actor.clinicId);
		const credentials: Credential[] = [
			{
				kind: 'DOH_LICENSE',
				subjectType: 'CLINIC',
				subjectId: clinic.id,
				subjectName: clinic.name,
				number: clinic.dohLicenseNo,
				expiresOn: dateOnly(clinic.dohLicenseExpiry),
			},
			{
				kind: 'PHILHEALTH_ACCREDITATION',
				subjectType: 'CLINIC',
				subjectId: clinic.id,
				subjectName: clinic.name,
				number: clinic.philhealthAccreditNo,
				expiresOn: dateOnly(clinic.philhealthAccreditExp),
			},
			...practitioners.flatMap((practitioner): Credential[] => {
				const subject = {
					subjectType: 'PRACTITIONER' as const,
					subjectId: practitioner.id,
					subjectName: practitioner.displayName,
				};
				return [
					{
						...subject,
						kind: 'PRC_LICENSE',
						number: practitioner.prcLicenseNo,
						expiresOn: practitioner.prcLicenseExpiry,
					},
					{
						...subject,
						kind: 'S2_LICENSE',
						number: practitioner.s2LicenseNo,
						expiresOn: practitioner.s2LicenseExpiry,
					},
					{
						...subject,
						kind: 'PHILHEALTH_PAN',
						number: practitioner.philhealthPan,
						expiresOn: practitioner.philhealthPanExpiry,
					},
				];
			}),
		];
		const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
		return expiringCredentials(credentials, today, withinDays).map((credential) => ({
			...credential,
			label: credentialLabel(credential.kind),
		}));
	}
}
