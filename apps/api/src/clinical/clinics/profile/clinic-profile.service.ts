import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { AccessService } from '../../../common/guards/access.service.js';
import { dateColumn, text } from '../../../common/input-values.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges } from '../../audit/audit-changes.js';
import { ReferenceService } from '../../reference/reference.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import type { ClinicActor } from '../clinic-admin-actor.js';
import { ClinicCodeTakenError, ClinicNameTakenError, OrganizationAdminRequiredError } from '../clinic-setup.errors.js';
import { ClinicProfileRepository, type ClinicProfileRow } from './clinic-profile.repository.js';
import type { UpdateClinicProfileInput, UpdateOrganizationProfileInput } from './dto/clinic-profile.input.js';
import { type ClinicSetupProfile, toClinicProfile, toOrganizationProfile } from './models/clinic-profile.model.js';

/**
 * The organization's legal details and the clinic's registrations (BIR, DOH License to Operate, PhilHealth
 * accreditation), PSGC address and contact: what invoices, prescriptions and certificates print. Clinic admins change
 * the clinic; the organization's legal details need its ADMIN or a SUPER_ADMIN. Writes are system work (users have
 * no UPDATE on these tables) in one transaction with their audit row.
 */
@Injectable()
export class ClinicProfileService {
	private readonly logger = new Logger(ClinicProfileService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly profiles: ClinicProfileRepository,
		private readonly reference: ReferenceService,
		private readonly access: AccessService,
		private readonly audit: AuditService,
	) {}

	async getProfile(actor: ClinicActor): Promise<ClinicSetupProfile> {
		const canEditOrganization = await this.canEditOrganization(actor);
		const row = await this.db.asUser(actor.userId, (tx) => this.profiles.findProfile(tx, actor.clinicId));
		return toPage(required(row, actor.clinicId), canEditOrganization);
	}

	async updateOrganization(actor: ClinicActor, input: UpdateOrganizationProfileInput): Promise<ClinicSetupProfile> {
		if (!(await this.canEditOrganization(actor))) {
			throw new OrganizationAdminRequiredError();
		}
		const row = await this.db.asSystem(async (tx) => {
			const before = required(await this.profiles.findProfile(tx, actor.clinicId), actor.clinicId);
			const after = await this.profiles.updateOrganization(tx, actor.organizationId, {
				name: input.name.trim(),
				tradeName: text(input.tradeName),
				tin: text(input.tin),
				vatRegistration: input.vatRegistration,
				secOrDtiNo: text(input.secOrDtiNo),
				logoUrl: text(input.logoUrl),
			});
			await this.audit.updated(tx, {
				event: 'organization.update',
				entityType: 'Organization',
				entityId: after.id,
				userId: actor.userId,
				organizationId: after.id,
				clinicId: actor.clinicId,
				changes: auditChanges(before.organization, after),
			});
			return { ...before, organization: after };
		});
		this.logger.log(`Organization ${actor.organizationId} profile updated`);
		return toPage(row, true);
	}

	async updateClinic(actor: ClinicActor, input: UpdateClinicProfileInput): Promise<ClinicSetupProfile> {
		const canEditOrganization = await this.canEditOrganization(actor);
		const code = input.code.trim().toUpperCase();
		const name = input.name.trim();
		const row = await this.db.asSystem(async (tx) => {
			const conflict = await this.profiles.findConflict(tx, actor.organizationId, actor.clinicId, { code, name });
			if (conflict.code) {
				throw new ClinicCodeTakenError(code);
			}
			if (conflict.name) {
				throw new ClinicNameTakenError(name);
			}
			const { cityMunicipality, barangay } = await this.reference.requireAddress(
				tx,
				text(input.cityMunicipalityCode),
				text(input.barangayCode),
			);
			const before = required(await this.profiles.findProfile(tx, actor.clinicId), actor.clinicId);
			const data = {
				code,
				name,
				birBranchCode: text(input.birBranchCode),
				dohLicenseNo: text(input.dohLicenseNo),
				dohLicenseExpiry: dateColumn(input.dohLicenseExpiry),
				philhealthAccreditNo: text(input.philhealthAccreditNo),
				philhealthAccreditExp: dateColumn(input.philhealthAccreditExp),
				addressLine: text(input.addressLine),
				cityMunicipalityCode: cityMunicipality?.code ?? null,
				barangayCode: barangay?.code ?? null,
				zipCode: text(input.zipCode) ?? cityMunicipality?.zipCode ?? null,
				contactNo: text(input.contactNo),
				email: text(input.email),
				isActive: input.isActive,
			} satisfies Prisma.ClinicUncheckedUpdateInput;
			const after = await this.profiles.updateClinic(tx, actor.clinicId, data);
			await this.audit.updated(tx, {
				event: 'clinic.update',
				entityType: 'Clinic',
				entityId: actor.clinicId,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: auditChanges(pick(before, Object.keys(data)), pick(after, Object.keys(data))),
			});
			return after;
		});
		return toPage(row, canEditOrganization);
	}

	/** The organization's ADMIN, or a SUPER_ADMIN at the clinic. */
	private async canEditOrganization(actor: ClinicActor): Promise<boolean> {
		if (actor.staffRoles.includes('SUPER_ADMIN')) {
			return true;
		}
		const membership = await this.access.resolveOrganizationMembership(actor.userId, actor.clinicId, null);
		return membership.role === 'ADMIN';
	}
}

function required(row: ClinicProfileRow | null, clinicId: string): ClinicProfileRow {
	if (!row) {
		throw new EntityNotFoundError('Clinic', clinicId);
	}
	return row;
}

function toPage(row: ClinicProfileRow, canEditOrganization: boolean): ClinicSetupProfile {
	return {
		organization: toOrganizationProfile(row.organization),
		clinic: toClinicProfile(row),
		canEditOrganization,
	};
}

function pick(row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
	return Object.fromEntries(keys.map((key) => [key, row[key]]));
}
