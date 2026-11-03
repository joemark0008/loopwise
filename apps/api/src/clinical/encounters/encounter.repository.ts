import { Injectable } from '@nestjs/common';

import type { Encounter, Prisma } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

/** Encounters. Every method takes the transaction of `ClinicalDbService.asUser`, so row-level security applies. */
@Injectable()
export class EncounterRepository {
	listByPatient(tx: Tx, patientId: string, take?: number): Promise<Encounter[]> {
		return tx.encounter.findMany({ where: { patientId }, orderBy: { startedAt: 'desc' }, take });
	}

	/** One of a patient's encounters (the latest when no id), with its facility and patient; null when hidden. */
	findOfPatient(tx: Tx, patientId: string, encounterId?: string) {
		return tx.encounter.findFirst({
			where: { patientId, ...(encounterId && { id: encounterId }) },
			orderBy: { startedAt: 'desc' },
			include: {
				organization: { select: { name: true } },
				patient: { select: { givenName: true, familyName: true } },
			},
		});
	}

	/** Null when row-level security hides it. */
	findById(tx: Tx, id: string): Promise<Encounter | null> {
		return tx.encounter.findUnique({ where: { id } });
	}

	/**
	 * With `expectedVersion`, only updates the encounter if its version is still that one (a trigger bumps it on every
	 * update), and returns null when it moved on: the check and the write are one statement, so no edit slips between.
	 */
	async updateNote(
		tx: Tx,
		id: string,
		note: Prisma.EncounterUpdateInput,
		expectedVersion?: number | null,
	): Promise<Encounter | null> {
		if (expectedVersion == null) {
			return tx.encounter.update({ where: { id }, data: note });
		}
		const { count } = await tx.encounter.updateMany({ where: { id, version: expectedVersion }, data: note });
		return count === 0 ? null : tx.encounter.findUnique({ where: { id } });
	}

	async isPatientVisible(tx: Tx, patientId: string): Promise<boolean> {
		return (await tx.patient.count({ where: { id: patientId } })) > 0;
	}

	create(tx: Tx, encounter: Prisma.EncounterUncheckedCreateInput): Promise<Encounter> {
		return tx.encounter.create({ data: encounter });
	}

	writeAudit(
		tx: Tx,
		entry: {
			userId: string;
			orgId: string;
			patientId: string;
			encounterId: string;
			origin?: Prisma.InputJsonObject;
		},
	) {
		return tx.auditLog.create({
			data: {
				userId: entry.userId,
				orgId: entry.orgId,
				patientId: entry.patientId,
				action: 'encounter.create',
				resource: 'encounter',
				resourceId: entry.encounterId,
				origin: entry.origin,
			},
		});
	}
}
