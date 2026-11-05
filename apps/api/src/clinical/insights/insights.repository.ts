import { Injectable } from '@nestjs/common';

import type { DiagnosticOrderStatus, Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

const HEADER = {
	identifications: { orderBy: { createdAt: 'asc' } },
	allergies: { where: { voidedAt: null, isActive: true }, orderBy: { notedAt: 'asc' } },
	consents: {
		where: { type: 'DATA_PRIVACY', granted: true, revokedAt: null },
		orderBy: { signedAt: 'desc' },
		take: 1,
	},
} satisfies Prisma.PatientInclude;

export type PatientHeaderRow = Prisma.PatientGetPayload<{ include: typeof HEADER }>;

const DIAGNOSIS_ORDER = [
	{ type: 'asc' },
	{ sortOrder: 'asc' },
] satisfies Prisma.EncounterDiagnosisOrderByWithRelationInput[];

const ENCOUNTER_SUMMARY = {
	diagnosis: { where: { voidedAt: null }, orderBy: DIAGNOSIS_ORDER },
} satisfies Prisma.EncounterInclude;

export type EncounterSummaryRow = Prisma.EncounterGetPayload<{ include: typeof ENCOUNTER_SUMMARY }>;

const PRESCRIPTION = { items: { orderBy: { sortOrder: 'asc' } } } satisfies Prisma.PrescriptionInclude;

export type PrescriptionRow = Prisma.PrescriptionGetPayload<{ include: typeof PRESCRIPTION }>;

const ENCOUNTER_RECORD = {
	patient: { include: HEADER },
	clinic: { select: { name: true, organizationId: true } },
	practitioner: true,
	vitals: { where: { voidedAt: null }, orderBy: { recordedAt: 'asc' } },
	diagnosis: { where: { voidedAt: null }, orderBy: DIAGNOSIS_ORDER },
	diagnosticOrders: {
		where: { status: { not: 'CANCELLED' } },
		include: {
			items: {
				include: { test: { select: { name: true } }, result: { include: { values: true } } },
			},
		},
		orderBy: { createdAt: 'asc' },
	},
	prescriptions: { where: { voidedAt: null }, include: PRESCRIPTION, orderBy: { createdAt: 'asc' } },
	medicalCertificates: { where: { isVoid: false }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.EncounterInclude;

export type EncounterRecordRow = Prisma.EncounterGetPayload<{ include: typeof ENCOUNTER_RECORD }>;

/** One released lab value, with the LOINC code of its parameter (or single-parameter test). */
export interface LabValueRow {
	resultId: string;
	code: string | null;
	name: string;
	value: string;
	valueNumeric: number | null;
	unit: string | null;
	referenceRange: string | null;
	flag: string | null;
	resultedAt: Date;
}

/** Orders still waiting on the lab: requested, paid, collected or in progress. */
const OPEN_ORDER_STATUSES: DiagnosticOrderStatus[] = ['REQUESTED', 'PAID', 'SPECIMEN_COLLECTED', 'IN_PROGRESS'];

const LAB_VALUE_SELECT = {
	name: true,
	value: true,
	numericValue: true,
	unit: true,
	referenceRange: true,
	flag: true,
	parameter: { select: { lisCode: true } },
	result: {
		select: {
			id: true,
			resultedAt: true,
			releasedAt: true,
			orderItem: { select: { test: { select: { lisCode: true } } } },
		},
	},
} satisfies Prisma.DiagnosticResultValueSelect;

/**
 * Reads of the Wise charts and summary reports (DESIGN.md §7.2). Every method takes the transaction of
 * `ClinicalDbService.asUser`, so row-level security decides what a chart or report can show. Encounter children are
 * reached through the encounter (`encounter: { patientId }`).
 */
@Injectable()
export class InsightsRepository {
	patientHeader(tx: ClinicalTx, patientId: string): Promise<PatientHeaderRow | null> {
		return tx.patient.findFirst({ where: { id: patientId, deletedAt: null }, include: HEADER });
	}

	/** The patient's vitals not voided, oldest first (since `since`). */
	vitals(tx: ClinicalTx, patientId: string, since: Date) {
		return tx.vitalSigns.findMany({
			where: { voidedAt: null, recordedAt: { gte: since }, encounter: { patientId } },
			orderBy: { recordedAt: 'asc' },
		});
	}

	/** The latest vitals rows not voided, newest first. */
	latestVitals(tx: ClinicalTx, patientId: string, take: number) {
		return tx.vitalSigns.findMany({
			where: { voidedAt: null, encounter: { patientId } },
			orderBy: { recordedAt: 'desc' },
			take,
		});
	}

	/**
	 * Released lab values of the patient: of the given LOINC codes (the parameter's `lis_code`, or the test's for a
	 * single-value test) since `since` oldest first, or the latest `take` of any test newest first.
	 */
	async labValues(
		tx: ClinicalTx,
		patientId: string,
		opts: { codes?: readonly string[]; since?: Date; take?: number },
	): Promise<LabValueRow[]> {
		const codes = opts.codes ? [...opts.codes] : undefined;
		const rows = await tx.diagnosticResultValue.findMany({
			where: {
				result: {
					releasedAt: { not: null },
					...(opts.since && { resultedAt: { gte: opts.since } }),
					orderItem: { order: { encounter: { patientId } } },
				},
				...(codes && {
					OR: [
						{ parameter: { lisCode: { in: codes } } },
						{ parameterId: null, result: { orderItem: { test: { lisCode: { in: codes } } } } },
					],
				}),
			},
			select: LAB_VALUE_SELECT,
			orderBy: { result: { resultedAt: opts.take ? 'desc' : 'asc' } },
			...(opts.take && { take: opts.take }),
		});
		return rows.map((row) => ({
			resultId: row.result.id,
			code: row.parameter?.lisCode ?? row.result.orderItem.test.lisCode,
			name: row.name,
			value: row.value,
			valueNumeric: row.numericValue === null ? null : Number(row.numericValue),
			unit: row.unit,
			referenceRange: row.referenceRange,
			flag: row.flag,
			resultedAt: row.result.resultedAt ?? row.result.releasedAt!,
		}));
	}

	diagnoses(tx: ClinicalTx, patientId: string) {
		return tx.encounterDiagnosis.findMany({
			where: { voidedAt: null, encounter: { patientId, status: { not: 'CANCELLED' } } },
			include: { encounter: { select: { startedAt: true } } },
		});
	}

	issuedPrescriptions(tx: ClinicalTx, patientId: string, since: Date): Promise<PrescriptionRow[]> {
		return tx.prescription.findMany({
			where: {
				documentStatus: 'ISSUED',
				voidedAt: null,
				issuedAt: { gte: since },
				encounter: { patientId },
			},
			include: PRESCRIPTION,
			orderBy: { issuedAt: 'desc' },
		});
	}

	encounters(tx: ClinicalTx, patientId: string, take: number): Promise<EncounterSummaryRow[]> {
		return tx.encounter.findMany({
			where: { patientId, status: { not: 'CANCELLED' } },
			include: ENCOUNTER_SUMMARY,
			orderBy: { startedAt: 'desc' },
			take,
		});
	}

	encounterRecord(tx: ClinicalTx, encounterId: string): Promise<EncounterRecordRow | null> {
		return tx.encounter.findUnique({ where: { id: encounterId }, include: ENCOUNTER_RECORD });
	}

	/** The clinic's visits since `since` that the user may see. */
	clinicEncounters(tx: ClinicalTx, clinicId: string, since: Date) {
		return tx.encounter.findMany({
			where: { clinicId, status: { not: 'CANCELLED' }, startedAt: { gte: since } },
			select: { startedAt: true, patientId: true },
		});
	}

	clinicDiagnoses(tx: ClinicalTx, clinicId: string, since: Date) {
		return tx.encounterDiagnosis.findMany({
			where: { voidedAt: null, encounter: { clinicId, startedAt: { gte: since } } },
			select: { icd10Code: true },
		});
	}

	openOrders(tx: ClinicalTx, clinicId: string) {
		return tx.diagnosticOrder.findMany({
			where: { status: { in: OPEN_ORDER_STATUSES }, encounter: { clinicId } },
			select: { createdAt: true },
		});
	}

	/** Released results of the clinic's visits no doctor has reviewed yet, with their value flags. */
	resultsAwaitingReview(tx: ClinicalTx, clinicId: string) {
		return tx.diagnosticResult.findMany({
			where: {
				releasedAt: { not: null },
				reviewedAt: null,
				orderItem: { order: { encounter: { clinicId } } },
			},
			select: { values: { select: { flag: true } } },
		});
	}

	async userName(tx: ClinicalTx, userId: string): Promise<string> {
		return (await tx.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? 'Unknown user';
	}
}
