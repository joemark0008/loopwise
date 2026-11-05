import { Injectable } from '@nestjs/common';

import type { Encounter, Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

const WITH_CONTEXT = {
	clinic: { select: { id: true, code: true, name: true, organizationId: true } },
	patient: { select: { firstName: true, lastName: true, organizationId: true } },
} satisfies Prisma.EncounterInclude;

/** An encounter with its clinic and patient names: what access checks and Wise drafts need. */
export type EncounterContextRow = Prisma.EncounterGetPayload<{ include: typeof WITH_CONTEXT }>;

/**
 * Encounters. Every method takes the caller's transaction: `ClinicalDbService.asUser` (row-level security applies)
 * or `asSystem` for the writes that also grant a care relationship.
 */
@Injectable()
export class EncounterRepository {
	/** The patient's visits, newest first (cancelled ones too). */
	listByPatient(tx: ClinicalTx, patientId: string, take?: number): Promise<Encounter[]> {
		return tx.encounter.findMany({ where: { patientId }, orderBy: { startedAt: 'desc' }, take });
	}

	/** Visits at a clinic, by status, oldest first (the day's queue). */
	listAtClinic(
		tx: ClinicalTx,
		opts: { clinicId: string; statuses: readonly Encounter['status'][]; startedFrom?: Date },
	): Promise<EncounterContextRow[]> {
		return tx.encounter.findMany({
			where: {
				clinicId: opts.clinicId,
				status: { in: [...opts.statuses] },
				...(opts.startedFrom && { startedAt: { gte: opts.startedFrom } }),
			},
			include: WITH_CONTEXT,
			orderBy: { startedAt: 'asc' },
		});
	}

	/** Null when row-level security hides it. */
	findById(tx: ClinicalTx, id: string): Promise<EncounterContextRow | null> {
		return tx.encounter.findUnique({ where: { id }, include: WITH_CONTEXT });
	}

	/** One of a patient's encounters (the latest when no id); null when hidden. */
	findOfPatient(tx: ClinicalTx, patientId: string, encounterId?: string): Promise<EncounterContextRow | null> {
		return tx.encounter.findFirst({
			where: { patientId, ...(encounterId && { id: encounterId }) },
			orderBy: { startedAt: 'desc' },
			include: WITH_CONTEXT,
		});
	}

	findPatientOrganization(tx: ClinicalTx, patientId: string): Promise<{ organizationId: string } | null> {
		return tx.patient.findFirst({ where: { id: patientId, deletedAt: null }, select: { organizationId: true } });
	}

	create(tx: ClinicalTx, encounter: Prisma.EncounterUncheckedCreateInput): Promise<Encounter> {
		return tx.encounter.create({ data: encounter });
	}

	/**
	 * With `expectedVersion`, only updates the encounter if its version is still that one (a trigger bumps it on every
	 * update), and returns null when it moved on: the check and the write are one statement, so no edit slips between.
	 */
	async update(
		tx: ClinicalTx,
		id: string,
		data: Prisma.EncounterUncheckedUpdateManyInput,
		expectedVersion?: number | null,
	): Promise<Encounter | null> {
		const { count } = await tx.encounter.updateMany({
			where: { id, ...(expectedVersion != null && { version: expectedVersion }) },
			data,
		});
		return count === 0 ? null : tx.encounter.findUnique({ where: { id } });
	}

	/** Gives the user a care relationship with the patient unless they have an open one (system work). */
	async addCareRelationship(
		tx: ClinicalTx,
		relationship: { patientId: string; userId: string; organizationId: string },
	): Promise<void> {
		const open = await tx.careRelationship.count({
			where: {
				patientId: relationship.patientId,
				userId: relationship.userId,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
		});
		if (open === 0) {
			await tx.careRelationship.create({ data: { ...relationship, reason: 'ENCOUNTER' } });
		}
	}
}
