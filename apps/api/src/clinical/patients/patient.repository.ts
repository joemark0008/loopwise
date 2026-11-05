import { Injectable } from '@nestjs/common';

import type { Clinic, Prisma } from '../../generated/prisma/client.js';
import type { CareRelationshipReason, IdentificationType, Sex } from '../../generated/prisma/enums.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

/** The consent the registration records (RA 10173): the version of the data-privacy notice shown. */
export const DATA_PRIVACY_CONSENT_VERSION = '2026-01';

export const PATIENT_INCLUDE = {
	identifications: { orderBy: { createdAt: 'asc' } },
	addresses: {
		where: { isPrimary: true },
		include: { barangay: true, cityMunicipality: true },
		take: 1,
	},
	consents: {
		where: { type: 'DATA_PRIVACY', granted: true, revokedAt: null },
		orderBy: { signedAt: 'desc' },
		take: 1,
	},
} satisfies Prisma.PatientInclude;

export type PatientRow = Prisma.PatientGetPayload<{ include: typeof PATIENT_INCLUDE }>;

/** A possible duplicate, read across row-level security (system work): only what the masked card shows. */
export type PatientMatchRow = Pick<PatientRow, 'id' | 'firstName' | 'lastName' | 'birthDate'>;

const MATCH_SELECT = { id: true, firstName: true, lastName: true, birthDate: true } satisfies Prisma.PatientSelect;

export interface NewPatient {
	organizationId: string;
	patientNo: string;
	firstName: string;
	middleName: string | null;
	lastName: string;
	birthDate: Date;
	sex: Sex;
	mobileNo: string | null;
	preferredLanguage: string;
	philHealthId: string | null;
	address: { addressLine: string | null; barangayCode: string | null; cityMunicipalityCode: string | null } | null;
	consentWitnessedById: string;
}

/**
 * Patients, their IDs, addresses, consents and care relationships. Every method takes the transaction of
 * `ClinicalDbService.asUser` (row-level security applies) or `asSystem` (registration, duplicate checks).
 */
@Injectable()
export class PatientRepository {
	getById(tx: ClinicalTx, id: string): Promise<PatientRow | null> {
		return tx.patient.findFirst({ where: { id, deletedAt: null }, include: PATIENT_INCLUDE });
	}

	/**
	 * Patients matching every name word (first, middle or last name), or one identifier (patient no. or an ID number),
	 * by name.
	 */
	search(
		tx: ClinicalTx,
		opts: { words: string[]; identifier?: string; birthDate?: Date; take: number },
	): Promise<PatientRow[]> {
		const byName: Prisma.PatientWhereInput[] = opts.words.map((word) => ({
			OR: [
				{ firstName: { contains: word, mode: 'insensitive' } },
				{ middleName: { contains: word, mode: 'insensitive' } },
				{ lastName: { contains: word, mode: 'insensitive' } },
			],
		}));
		const byIdentifier: Prisma.PatientWhereInput[] = opts.identifier
			? [
					{ patientNo: { equals: opts.identifier, mode: 'insensitive' } },
					{ identifications: { some: { idNumber: { equals: opts.identifier, mode: 'insensitive' } } } },
				]
			: [];
		return tx.patient.findMany({
			where: {
				deletedAt: null,
				AND: [
					byIdentifier.length > 0 ? { OR: [{ AND: byName }, ...byIdentifier] } : { AND: byName },
					...(opts.birthDate ? [{ birthDate: opts.birthDate }] : []),
				],
			},
			include: PATIENT_INCLUDE,
			orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
			take: opts.take,
		});
	}

	/** Which of `ids` the transaction's user can see. */
	async visibleIds(tx: ClinicalTx, ids: readonly string[]): Promise<Set<string>> {
		if (ids.length === 0) {
			return new Set();
		}
		const rows = await tx.patient.findMany({ where: { id: { in: [...ids] } }, select: { id: true } });
		return new Set(rows.map((row) => row.id));
	}

	/** The patient's organization, as a quick existence check under the caller's row-level security. */
	findOrganizationId(tx: ClinicalTx, id: string): Promise<{ organizationId: string } | null> {
		return tx.patient.findFirst({ where: { id, deletedAt: null }, select: { organizationId: true } });
	}

	findByPatientNo(tx: ClinicalTx, organizationId: string, patientNo: string): Promise<PatientMatchRow[]> {
		return tx.patient.findMany({
			where: { organizationId, patientNo: { equals: patientNo, mode: 'insensitive' }, deletedAt: null },
			select: MATCH_SELECT,
		});
	}

	findByIdentification(
		tx: ClinicalTx,
		organizationId: string,
		type: IdentificationType,
		idNumber: string,
	): Promise<PatientMatchRow[]> {
		return tx.patient.findMany({
			where: {
				organizationId,
				deletedAt: null,
				identifications: { some: { type, idNumber: { equals: idNumber, mode: 'insensitive' } } },
			},
			select: MATCH_SELECT,
		});
	}

	/** Patients of the organization with the same name (case-insensitive), birth date and sex. */
	findByNameBirthSex(
		tx: ClinicalTx,
		organizationId: string,
		opts: { firstName: string; lastName: string; birthDate: Date; sex: Sex },
	): Promise<PatientMatchRow[]> {
		return tx.patient.findMany({
			where: {
				organizationId,
				deletedAt: null,
				firstName: { equals: opts.firstName, mode: 'insensitive' },
				lastName: { equals: opts.lastName, mode: 'insensitive' },
				birthDate: opts.birthDate,
				sex: opts.sex,
			},
			select: MATCH_SELECT,
		});
	}

	/** The patient with their PhilHealth ID, primary address and data-privacy consent, in one statement. */
	create(tx: ClinicalTx, patient: NewPatient): Promise<PatientRow> {
		return tx.patient.create({
			data: {
				organizationId: patient.organizationId,
				patientNo: patient.patientNo,
				firstName: patient.firstName,
				middleName: patient.middleName,
				lastName: patient.lastName,
				birthDate: patient.birthDate,
				sex: patient.sex,
				mobileNo: patient.mobileNo,
				preferredLanguage: patient.preferredLanguage,
				identifications: patient.philHealthId
					? { create: { type: 'PHILHEALTH_ID', idNumber: patient.philHealthId } }
					: undefined,
				addresses: patient.address
					? { create: { type: 'HOME', isPrimary: true, ...patient.address } }
					: undefined,
				consents: {
					create: {
						type: 'DATA_PRIVACY',
						version: DATA_PRIVACY_CONSENT_VERSION,
						granted: true,
						witnessedById: patient.consentWitnessedById,
					},
				},
			},
			include: PATIENT_INCLUDE,
		});
	}

	/** Adds the ID unless the patient already holds it. */
	async addIdentification(
		tx: ClinicalTx,
		patientId: string,
		identification: { type: IdentificationType; idNumber: string },
	): Promise<void> {
		await tx.patientIdentification.createMany({ data: [{ patientId, ...identification }], skipDuplicates: true });
	}

	/** Records a data-privacy consent unless one is on file. */
	async addConsentIfMissing(tx: ClinicalTx, patientId: string, witnessedById: string): Promise<void> {
		const existing = await tx.patientConsent.count({
			where: { patientId, type: 'DATA_PRIVACY', granted: true, revokedAt: null },
		});
		if (existing === 0) {
			await tx.patientConsent.create({
				data: {
					patientId,
					type: 'DATA_PRIVACY',
					version: DATA_PRIVACY_CONSENT_VERSION,
					granted: true,
					witnessedById,
				},
			});
		}
	}

	/** Gives the user a care relationship with the patient unless they have an open one (system work). */
	async addCareRelationship(
		tx: ClinicalTx,
		relationship: { patientId: string; userId: string; organizationId: string; reason: CareRelationshipReason },
	): Promise<void> {
		const open = await tx.careRelationship.count({
			where: {
				patientId: relationship.patientId,
				userId: relationship.userId,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
		});
		if (open === 0) {
			await tx.careRelationship.create({ data: relationship });
		}
	}

	/** Contact details only; row-level security lets the user change a patient they may see, of their organization. */
	updateContact(
		tx: ClinicalTx,
		id: string,
		data: { mobileNo?: string | null; preferredLanguage?: string },
	): Promise<unknown> {
		return tx.patient.update({ where: { id }, data });
	}

	/** Sets the primary address (one row), creating it when there is none. */
	async upsertPrimaryAddress(
		tx: ClinicalTx,
		patientId: string,
		address: { addressLine?: string | null; barangayCode?: string | null; cityMunicipalityCode?: string | null },
	): Promise<void> {
		const current = await tx.patientAddress.findFirst({ where: { patientId, isPrimary: true } });
		if (current) {
			await tx.patientAddress.update({ where: { id: current.id }, data: address });
		} else {
			await tx.patientAddress.create({ data: { patientId, type: 'HOME', isPrimary: true, ...address } });
		}
	}

	/** Clinics by id (names and codes are readable by everyone signed in). */
	findClinics(tx: ClinicalTx, ids: readonly string[]): Promise<Clinic[]> {
		return tx.clinic.findMany({ where: { id: { in: [...ids] } } });
	}
}
