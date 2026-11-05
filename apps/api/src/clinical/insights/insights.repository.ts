import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

const header = {
	identifiers: { include: { organization: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
	allergies: { where: { voidedAt: null }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PatientInclude;

export type PatientHeaderRow = Prisma.PatientGetPayload<{ include: typeof header }>;

const encounterSummary = {
	diagnoses: { where: { voidedAt: null }, orderBy: [{ isPrimary: 'desc' }, { rank: 'asc' }] },
} satisfies Prisma.EncounterInclude;

export type EncounterSummaryRow = Prisma.EncounterGetPayload<{ include: typeof encounterSummary }>;

const issuedPrescription = {
	items: { orderBy: { position: 'asc' } },
} satisfies Prisma.PrescriptionInclude;

export type PrescriptionRow = Prisma.PrescriptionGetPayload<{ include: typeof issuedPrescription }>;

const encounterRecord = {
	patient: { include: header },
	organization: { select: { name: true } },
	doctor: { select: { name: true } },
	vitalSigns: { where: { voidedAt: null }, orderBy: { recordedAt: 'asc' } },
	diagnoses: { where: { voidedAt: null }, orderBy: [{ isPrimary: 'desc' }, { rank: 'asc' }] },
	orders: { include: { results: { orderBy: { resultedAt: 'asc' } } }, orderBy: { createdAt: 'asc' } },
	prescriptions: { where: { status: { not: 'voided' } }, include: issuedPrescription, orderBy: { createdAt: 'asc' } },
	certificates: { where: { status: { not: 'voided' } }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.EncounterInclude;

export type EncounterRecordRow = Prisma.EncounterGetPayload<{ include: typeof encounterRecord }>;

/** Orders still waiting on the lab or imaging: sent, accepted or collected, not resulted. */
const OPEN_ORDER_STATUSES = ['sent', 'accepted', 'collected'] as const;

export interface InsightsAuditEntry {
	userId: string;
	orgId?: string | null;
	patientId?: string | null;
	/** `<resource>.<verb>`: `patient.view`, `report.generate`, `report.export`. */
	action: string;
	resource: string;
	resourceId?: string | null;
	reason?: string | null;
}

/**
 * Reads of the Wise charts and summary reports (DESIGN.md §7.2). Every method takes the transaction of
 * `ClinicalDbService.asUser`, so row-level security decides what a chart or report can show.
 */
@Injectable()
export class InsightsRepository {
	patientHeader(tx: Tx, patientId: string): Promise<PatientHeaderRow | null> {
		return tx.patient.findUnique({ where: { id: patientId }, include: header });
	}

	vitals(tx: Tx, patientId: string, since: Date) {
		return tx.vitalSigns.findMany({
			where: { patientId, voidedAt: null, recordedAt: { gte: since } },
			orderBy: { recordedAt: 'asc' },
		});
	}

	/** The latest non-voided vitals rows, newest first. */
	latestVitals(tx: Tx, patientId: string, take: number) {
		return tx.vitalSigns.findMany({
			where: { patientId, voidedAt: null },
			orderBy: { recordedAt: 'desc' },
			take,
		});
	}

	results(tx: Tx, patientId: string, opts: { codes?: string[]; since?: Date; take?: number }) {
		return tx.result.findMany({
			where: {
				patientId,
				...(opts.codes && { code: { in: opts.codes } }),
				...(opts.since && { resultedAt: { gte: opts.since } }),
			},
			orderBy: { resultedAt: opts.take ? 'desc' : 'asc' },
			...(opts.take && { take: opts.take }),
		});
	}

	diagnoses(tx: Tx, patientId: string) {
		return tx.encounterDiagnosis.findMany({
			where: { patientId, voidedAt: null },
			include: { encounter: { select: { startedAt: true } } },
		});
	}

	issuedPrescriptions(tx: Tx, patientId: string, since: Date): Promise<PrescriptionRow[]> {
		return tx.prescription.findMany({
			where: { patientId, status: 'issued', voidedAt: null, issuedAt: { gte: since } },
			include: issuedPrescription,
			orderBy: { issuedAt: 'desc' },
		});
	}

	encounters(tx: Tx, patientId: string, take: number): Promise<EncounterSummaryRow[]> {
		return tx.encounter.findMany({
			where: { patientId },
			include: encounterSummary,
			orderBy: { startedAt: 'desc' },
			take,
		});
	}

	encounterRecord(tx: Tx, encounterId: string): Promise<EncounterRecordRow | null> {
		return tx.encounter.findUnique({ where: { id: encounterId }, include: encounterRecord });
	}

	/** The facility's encounters since `since` that the user may see. */
	facilityEncounters(tx: Tx, orgId: string, since: Date) {
		return tx.encounter.findMany({
			where: { orgId, startedAt: { gte: since } },
			select: { startedAt: true, patientId: true },
		});
	}

	facilityDiagnoses(tx: Tx, orgId: string, since: Date) {
		return tx.encounterDiagnosis.findMany({
			where: { orgId, voidedAt: null, encounter: { startedAt: { gte: since } } },
			select: { icd10Code: true },
		});
	}

	openOrders(tx: Tx, orgId: string) {
		return tx.clinicalOrder.findMany({
			where: { orderingOrgId: orgId, status: { in: [...OPEN_ORDER_STATUSES] } },
			select: { sentAt: true, createdAt: true },
		});
	}

	resultsAwaitingReview(tx: Tx, orgId: string) {
		return tx.result.findMany({
			where: { reviewedAt: null, order: { orderingOrgId: orgId } },
			select: { flag: true },
		});
	}

	async userName(tx: Tx, userId: string): Promise<string> {
		return (await tx.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? 'Unknown user';
	}

	writeAudit(tx: Tx, entry: InsightsAuditEntry) {
		return tx.auditLog.create({
			data: {
				userId: entry.userId,
				orgId: entry.orgId ?? null,
				patientId: entry.patientId ?? null,
				action: entry.action,
				resource: entry.resource,
				resourceId: entry.resourceId ?? null,
				reason: entry.reason ?? null,
			},
		});
	}
}
