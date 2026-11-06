import { Injectable } from '@nestjs/common';

import type { IdentificationType, StaffRole } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

export interface DiscountIdentificationRow {
	id: string;
	type: IdentificationType;
	idNumber: string;
	expiresAt: Date | null;
}

/** The facts a discount is checked against: the patient's SC/PWD IDs and who may approve at the clinic. */
@Injectable()
export class InvoiceDiscountRepository {
	/** The patient's IDs of these types (row-level security: the user must see the patient). */
	listIdentifications(
		tx: ClinicalTx,
		patientId: string,
		types: readonly IdentificationType[],
	): Promise<DiscountIdentificationRow[]> {
		return tx.patientIdentification.findMany({
			where: { patientId, type: { in: [...types] } },
			select: { id: true, type: true, idNumber: true, expiresAt: true },
			orderBy: { createdAt: 'asc' },
		});
	}

	/** Staff of the clinic holding one of the roles, with their name. */
	async staffWithRoles(
		tx: ClinicalTx,
		clinicId: string,
		roles: readonly StaffRole[],
	): Promise<{ userId: string; name: string; roles: StaffRole[] }[]> {
		const rows = await tx.userClinicRole.findMany({
			where: { clinicId, role: { in: [...roles] }, user: { isActive: true } },
			select: { role: true, user: { select: { id: true, name: true, firstName: true, lastName: true } } },
		});
		const byUser = new Map<string, { userId: string; name: string; roles: StaffRole[] }>();
		for (const row of rows) {
			const entry = byUser.get(row.user.id) ?? {
				userId: row.user.id,
				name: row.user.name || `${row.user.firstName} ${row.user.lastName}`.trim(),
				roles: [],
			};
			entry.roles.push(row.role);
			byUser.set(row.user.id, entry);
		}
		return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
	}
}
