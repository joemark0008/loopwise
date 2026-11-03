import { Injectable } from '@nestjs/common';

import type { ClinicalOrder, Patient, Prisma, Result } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

export type InboxRow = Prisma.ResultGetPayload<{
	include: {
		patient: { select: { id: true; givenName: true; familyName: true; birthDate: true; sex: true } };
		sourceOrg: { select: { id: true; name: true } };
		order: { select: { id: true; status: true; priority: true; orderingDoctorId: true; orderingOrgId: true } };
	};
}>;

const INBOX_INCLUDE = {
	patient: { select: { id: true, givenName: true, familyName: true, birthDate: true, sex: true } },
	sourceOrg: { select: { id: true, name: true } },
	order: { select: { id: true, status: true, priority: true, orderingDoctorId: true, orderingOrgId: true } },
} as const;

/**
 * Results. Ingest methods take the system transaction (`ClinicalDbService.asSystem`); inbox and review methods take
 * the user's (`asUser`), so row-level security decides what is visible.
 */
@Injectable()
export class ResultRepository {
	/** Patients with this identifier at the organization (any system). */
	async patientIdsByIdentifierAtOrg(tx: Tx, orgId: string, values: string[]): Promise<string[]> {
		if (values.length === 0) {
			return [];
		}
		const rows = await tx.patientIdentifier.findMany({
			where: { orgId, value: { in: values } },
			select: { patientId: true },
		});
		return unique(rows.map((row) => row.patientId));
	}

	/** Patients with this PhilHealth number, at any facility. */
	async patientIdsByPhilHealth(tx: Tx, values: string[]): Promise<string[]> {
		if (values.length === 0) {
			return [];
		}
		const rows = await tx.patientIdentifier.findMany({
			where: { system: 'PhilHealth', value: { in: values } },
			select: { patientId: true },
		});
		return unique(rows.map((row) => row.patientId));
	}

	/** An order sent to the facility, by id. Orders sent elsewhere are invisible to the facility's messages. */
	findOrderForFacility(tx: Tx, orderId: string, targetOrgId: string): Promise<ClinicalOrder | null> {
		return tx.clinicalOrder.findFirst({ where: { id: orderId, targetOrgId } });
	}

	/** The patient's one open order at the facility for this test, when there is exactly one. */
	async findOpenOrderByCode(
		tx: Tx,
		patientId: string,
		targetOrgId: string,
		code: string,
	): Promise<ClinicalOrder | null> {
		const rows = await tx.clinicalOrder.findMany({
			where: { patientId, targetOrgId, code, status: { in: ['sent', 'accepted', 'collected'] } },
			take: 2,
		});
		return rows.length === 1 ? rows[0] : null;
	}

	findPatient(tx: Tx, id: string): Promise<Patient | null> {
		return tx.patient.findUnique({ where: { id } });
	}

	create(tx: Tx, data: Prisma.ResultUncheckedCreateInput): Promise<Result> {
		return tx.result.create({ data });
	}

	/**
	 * The user's results to review: unreviewed results of orders they placed, and unreviewed results with no Loopwise
	 * order for patients they can see, except those their own facility sent (a lab does not review its own output).
	 */
	listToReview(tx: Tx, userId: string, ownOrgIds: string[], limit: number): Promise<InboxRow[]> {
		return tx.result.findMany({
			where: {
				reviewedAt: null,
				OR: [{ order: { orderingDoctorId: userId } }, { orderId: null, sourceOrgId: { notIn: ownOrgIds } }],
			},
			include: INBOX_INCLUDE,
			orderBy: { receivedAt: 'asc' },
			take: limit,
		});
	}

	/** Every result of the patient the user can see, newest first. */
	listForPatient(tx: Tx, patientId: string, limit: number): Promise<InboxRow[]> {
		return tx.result.findMany({
			where: { patientId },
			include: INBOX_INCLUDE,
			orderBy: [{ resultedAt: 'desc' }, { receivedAt: 'desc' }],
			take: limit,
		});
	}

	/** The latest rules-engine evaluation of each result, with its pathway's name; RLS shows only readable results'. */
	latestEvaluations(tx: Tx, resultIds: string[]) {
		return tx.resultEvaluation.findMany({
			where: { resultId: { in: resultIds } },
			include: { pathway: { select: { name: true } } },
			orderBy: { evaluatedAt: 'desc' },
		});
	}

	findForReview(tx: Tx, id: string): Promise<InboxRow | null> {
		return tx.result.findUnique({ where: { id }, include: INBOX_INCLUDE });
	}

	/** Marks a result reviewed unless someone already did; the number of rows changed (0 or 1). */
	async markReviewed(tx: Tx, id: string, userId: string, at: Date): Promise<number> {
		const { count } = await tx.result.updateMany({
			where: { id, reviewedAt: null },
			data: { reviewedAt: at, reviewedById: userId },
		});
		return count;
	}
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}
