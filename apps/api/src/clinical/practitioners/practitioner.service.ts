import { Injectable, Logger } from '@nestjs/common';

import { AccessService } from '../../common/guards/access.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { auditChanges } from '../audit/audit-changes.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import type { SaveMyPractitionerInput } from './dto/practitioner-profile.input.js';
import type { DocumentSignatory } from './models/document-signatory.model.js';
import { type Practitioner, practitionerDisplayName, toPractitioner } from './models/practitioner.model.js';
import { PractitionerRepository, type PractitionerRow } from './practitioner.repository.js';
import { PractitionerProfileRequiredError, PrcLicenseTakenError } from './practitioners.errors.js';

/**
 * Practitioners (doctors, dentists, midwives …): the people whose PRC license, PTR and S2 numbers PH prescriptions,
 * certificates and referrals must print. A user keeps their own profile (row-level security: own rows only); the other
 * clinical modules ask here who signs a document and what to print.
 */
@Injectable()
export class PractitionerService {
	private readonly logger = new Logger(PractitionerService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly practitioners: PractitionerRepository,
		private readonly access: AccessService,
		private readonly audit: AuditService,
	) {}

	/** The signed-in user's practitioner profile, or null before they add one. */
	myPractitioner(userId: string): Promise<Practitioner | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.practitioners.findByUserId(tx, userId);
			return row && toPractitioner(row);
		});
	}

	/**
	 * Creates or updates the user's own profile. The PRC license number is required and belongs to one practitioner
	 * (PRC_LICENSE_TAKEN otherwise). A new profile is linked to the clinics the user works at.
	 */
	async saveMine(userId: string, input: SaveMyPractitionerInput): Promise<Practitioner> {
		const clinicIds = (await this.access.listUserClinics(userId)).map(({ clinic }) => clinic.id);
		const prcLicenseNo = input.prcLicenseNo.trim();
		try {
			return await this.db.asUser(userId, async (tx) => {
				const current = await this.practitioners.findByUserId(tx, userId);
				const user = await this.practitioners.getUserNames(tx, userId);
				const data = {
					type: input.type ?? current?.type ?? 'PHYSICIAN',
					title: text(input.title),
					firstName: text(input.firstName) ?? current?.firstName ?? user.firstName,
					middleName: text(input.middleName),
					lastName: text(input.lastName) ?? current?.lastName ?? user.lastName,
					suffix: text(input.suffix),
					postNominals: text(input.postNominals),
					specialty: text(input.specialty),
					subspecialty: text(input.subspecialty),
					prcLicenseNo,
					prcLicenseExpiry: date(input.prcLicenseExpiry),
					ptrNo: text(input.ptrNo),
					ptrIssuedDate: date(input.ptrIssuedDate),
					ptrIssuedAt: text(input.ptrIssuedAt),
					s2LicenseNo: text(input.s2LicenseNo),
					s2LicenseExpiry: date(input.s2LicenseExpiry),
					philhealthPan: text(input.philhealthPan),
					philhealthPanExpiry: date(input.philhealthPanExpiry),
				} satisfies Prisma.PractitionerUncheckedUpdateInput;
				const row = current
					? await this.practitioners.update(tx, current.id, data)
					: await this.practitioners.create(tx, { ...data, userId, email: user.email });
				if (!current) {
					await this.practitioners.linkClinics(tx, row.id, clinicIds);
				}
				await this.audit.record(tx, {
					action: current ? 'UPDATE' : 'CREATE',
					event: current ? 'practitioner.update' : 'practitioner.create',
					entityType: 'Practitioner',
					entityId: row.id,
					userId,
					changes: auditChanges(current ? snapshot(current) : null, snapshot(row)),
				});
				const saved = current ? row : await this.practitioners.findById(tx, row.id);
				return toPractitioner(saved ?? row);
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				this.logger.warn(`PRC license already on another profile (user ${userId})`);
				throw new PrcLicenseTakenError(prcLicenseNo);
			}
			throw error;
		}
	}

	/** The practitioners holding clinic at `clinicId` (internal referral targets, the doctor of a visit). */
	listAtClinic(userId: string, clinicId: string): Promise<Practitioner[]> {
		return this.db.asUser(userId, async (tx) =>
			(await this.practitioners.listAtClinic(tx, clinicId)).map(toPractitioner),
		);
	}

	/** Practitioners by id, on the caller's transaction (anyone signed in reads credentials). */
	async findManyByIds(tx: ClinicalTx, ids: readonly string[]): Promise<Practitioner[]> {
		return (await this.practitioners.findManyByIds(tx, ids)).map(toPractitioner);
	}

	/** The user's practitioner id, or null when they have no profile; on the caller's transaction. */
	async findIdForUser(tx: ClinicalTx, userId: string): Promise<string | null> {
		return (await this.practitioners.findByUserId(tx, userId))?.id ?? null;
	}

	/**
	 * The user's practitioner, required to sign `document` (a prescription, certificate, referral): refused with
	 * PRACTITIONER_PROFILE_REQUIRED until they add their PRC license.
	 */
	async requireForUser(tx: ClinicalTx, userId: string, document: string): Promise<Practitioner> {
		const row = await this.practitioners.findByUserId(tx, userId);
		if (!row) {
			throw new PractitionerProfileRequiredError(document);
		}
		return toPractitioner(row);
	}

	/**
	 * What a document prints about who signs it, as of now: the practitioner's name and credentials and the clinic's
	 * letterhead (address from PSGC). Frozen into `signatory` when the document is issued.
	 */
	async signatory(tx: ClinicalTx, practitionerId: string, clinicId: string): Promise<DocumentSignatory> {
		// One after the other: a transaction's queries share one connection.
		const practitioner = await this.practitioners.findById(tx, practitionerId);
		const clinic = await this.practitioners.getClinicLetterhead(tx, clinicId);
		const address = [
			clinic.addressLine,
			clinic.barangay?.name,
			clinic.cityMunicipality?.name,
			clinic.cityMunicipality?.province?.name,
		]
			.filter(Boolean)
			.join(', ');
		return {
			practitionerId,
			name: practitioner
				? practitionerDisplayName({ ...practitioner, postNominals: null })
				: 'Unknown practitioner',
			credentials: practitioner?.postNominals ?? null,
			specialty: practitioner?.specialty ?? null,
			licenseNumber: practitioner?.prcLicenseNo ?? null,
			ptrNumber: practitioner?.ptrNo ?? null,
			s2LicenseNo: practitioner?.s2LicenseNo ?? null,
			facilityName: clinic.name,
			facilityAddress: address || null,
			facilityPhone: clinic.contactNo,
		};
	}
}

const text = (value: string | null | undefined) => value?.trim() || null;

const date = (value: string | null | undefined) => (value ? new Date(`${value}T00:00:00Z`) : null);

function snapshot(row: PractitionerRow): Prisma.InputJsonObject {
	return {
		type: row.type,
		title: row.title,
		firstName: row.firstName,
		lastName: row.lastName,
		postNominals: row.postNominals,
		specialty: row.specialty,
		prcLicenseNo: row.prcLicenseNo,
		ptrNo: row.ptrNo,
		s2LicenseNo: row.s2LicenseNo,
		philhealthPan: row.philhealthPan,
	};
}
