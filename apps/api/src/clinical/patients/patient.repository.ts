import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { CareRelationshipReason, Sex } from '../../generated/prisma/enums.js';

type Tx = Prisma.TransactionClient;

const withIdentifiers = {
	identifiers: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PatientInclude;

export type PatientRow = Prisma.PatientGetPayload<{ include: typeof withIdentifiers }>;

/** A possible duplicate with the facilities it is registered at, read across row-level security (system work). */
export type PatientMatchRow = Prisma.PatientGetPayload<{
	include: { identifiers: { include: { organization: { select: { name: true } } } } };
}>;

const withFacilityNames = {
	identifiers: { include: { organization: { select: { name: true } } } },
} satisfies Prisma.PatientInclude;

const chartSummary = {
	identifiers: { include: { organization: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
	encounters: {
		orderBy: { startedAt: 'desc' },
		take: 5,
		select: {
			id: true,
			startedAt: true,
			reason: true,
			notes: true,
			history: true,
			physicalExam: true,
			assessment: true,
			plan: true,
			patientInstructions: true,
			followUpOn: true,
		},
	},
	allergies: {
		where: { voidedAt: null },
		select: { substance: true, reaction: true },
		orderBy: { createdAt: 'asc' },
	},
	diagnoses: {
		where: { voidedAt: null },
		select: { icd10Code: true, display: true },
		orderBy: { createdAt: 'desc' },
	},
	vitalSigns: {
		where: { voidedAt: null, systolicMmHg: { not: null } },
		select: { recordedAt: true, systolicMmHg: true, diastolicMmHg: true, weightKg: true, bmi: true },
		orderBy: { recordedAt: 'desc' },
		take: 1,
	},
	results: {
		select: { id: true, resultedAt: true, display: true, code: true, value: true, unit: true, flag: true },
		orderBy: { resultedAt: 'desc' },
		take: 5,
	},
	prescriptions: {
		where: { status: 'issued', voidedAt: null },
		select: { issuedAt: true, items: { select: { genericName: true, strength: true, frequency: true } } },
		orderBy: { issuedAt: 'desc' },
		take: 5,
	},
} satisfies Prisma.PatientInclude;

export type PatientChartRow = Prisma.PatientGetPayload<{ include: typeof chartSummary }>;

export interface NewPatient {
	givenName: string;
	familyName: string;
	birthDate: Date;
	sex: Sex;
	phone: string | null;
	preferredLanguage: string;
	consentAt: Date;
}

export interface NewIdentifier {
	orgId: string;
	system: string;
	value: string;
}

export interface NewAuditEntry {
	userId: string;
	orgId?: string;
	action: string;
	patientId?: string;
	reason?: string;
	/** Set when the action came from a confirmed Wise card. */
	origin?: Prisma.InputJsonObject;
}

/**
 * Patients, their identifiers and care relationships. Every method takes the transaction of
 * `ClinicalDbService.asUser` (row-level security applies) or `asSystem` (registration, duplicate checks).
 */
@Injectable()
export class PatientRepository {
	getById(tx: Tx, id: string): Promise<PatientRow | null> {
		return tx.patient.findUnique({ where: { id }, include: withIdentifiers });
	}

	/** The patient with their identifiers and latest encounters: what Wise is told about the patient of a chart chat. */
	getChart(tx: Tx, id: string): Promise<PatientChartRow | null> {
		return tx.patient.findUnique({ where: { id }, include: chartSummary });
	}

	/** Patients matching every name word (given or family name) or an identifier value, newest first. */
	search(
		tx: Tx,
		opts: { words: string[]; identifier?: string; birthDate?: Date; take: number },
	): Promise<PatientRow[]> {
		const byName: Prisma.PatientWhereInput[] = opts.words.map((word) => ({
			OR: [
				{ givenName: { contains: word, mode: 'insensitive' } },
				{ familyName: { contains: word, mode: 'insensitive' } },
			],
		}));
		const where: Prisma.PatientWhereInput = {
			AND: [
				...(opts.identifier
					? [
							{
								OR: [
									{ AND: byName },
									{
										identifiers: {
											some: { value: { equals: opts.identifier, mode: 'insensitive' } },
										},
									},
								],
							} satisfies Prisma.PatientWhereInput,
						]
					: byName),
				...(opts.birthDate ? [{ birthDate: opts.birthDate }] : []),
			],
		};
		return tx.patient.findMany({
			where,
			include: withIdentifiers,
			orderBy: [{ familyName: 'asc' }, { givenName: 'asc' }],
			take: opts.take,
		});
	}

	/** Which of `ids` the transaction's user can see. */
	async visibleIds(tx: Tx, ids: string[]): Promise<Set<string>> {
		if (ids.length === 0) {
			return new Set();
		}
		const rows = await tx.patient.findMany({ where: { id: { in: ids } }, select: { id: true } });
		return new Set(rows.map((row) => row.id));
	}

	/** Patients holding the identifier, at `orgId` or (without it) at any facility. */
	findByIdentifier(tx: Tx, opts: { system: string; value: string; orgId?: string }): Promise<PatientMatchRow[]> {
		return tx.patient.findMany({
			where: {
				identifiers: {
					some: {
						system: opts.system,
						value: { equals: opts.value, mode: 'insensitive' },
						...(opts.orgId && { orgId: opts.orgId }),
					},
				},
			},
			include: withFacilityNames,
		});
	}

	/** Patients with the same name (case-insensitive), birth date and sex. Names are stored single-spaced. */
	findByNameBirthSex(
		tx: Tx,
		opts: { givenName: string; familyName: string; birthDate: Date; sex: Sex },
	): Promise<PatientMatchRow[]> {
		return tx.patient.findMany({
			where: {
				givenName: { equals: opts.givenName, mode: 'insensitive' },
				familyName: { equals: opts.familyName, mode: 'insensitive' },
				birthDate: opts.birthDate,
				sex: opts.sex,
			},
			include: withFacilityNames,
		});
	}

	create(tx: Tx, patient: NewPatient): Promise<{ id: string }> {
		return tx.patient.create({ data: patient, select: { id: true } });
	}

	/** Adds the identifiers the patient doesn't hold yet at that facility. */
	async addIdentifiers(tx: Tx, patientId: string, identifiers: NewIdentifier[]): Promise<void> {
		for (const identifier of identifiers) {
			const existing = await tx.patientIdentifier.findFirst({
				where: { patientId, orgId: identifier.orgId, system: identifier.system },
			});
			if (!existing) {
				await tx.patientIdentifier.create({ data: { patientId, ...identifier } });
			}
		}
	}

	setConsentIfMissing(tx: Tx, patientId: string, consentAt: Date): Promise<unknown> {
		return tx.patient.updateMany({ where: { id: patientId, consentAt: null }, data: { consentAt } });
	}

	addCareRelationship(
		tx: Tx,
		relationship: { patientId: string; userId: string; orgId: string; reason: CareRelationshipReason },
	): Promise<unknown> {
		return tx.careRelationship.create({ data: relationship });
	}

	/** Contact details only; RLS lets the user change a patient in their care. */
	updateContact(
		tx: Tx,
		id: string,
		data: { phone?: string | null; preferredLanguage?: string; barangay?: string | null },
	): Promise<unknown> {
		return tx.patient.update({ where: { id }, data });
	}

	writeAudit(tx: Tx, entry: NewAuditEntry): Promise<unknown> {
		return tx.auditLog.create({ data: { ...entry, resource: 'patient', resourceId: entry.patientId } });
	}
}
