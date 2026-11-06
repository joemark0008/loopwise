import type { StaffRole } from '@loopwise/shared/staff-roles';
import { Injectable } from '@nestjs/common';

import { AccessService } from '../../common/guards/access.service.js';
import type { ClinicActor } from '../clinics/clinic-admin-actor.js';
import { InventoryDeskAccessError } from './inventory.errors.js';

/**
 * The desks of pharmacy and inventory (DESIGN.md §8) and the clinic roles that work them; clinic admins (ADMIN,
 * SUPER_ADMIN, an organization admin) work every desk, as `@ClinicAccess({ staffRoles })` lets them.
 */
export const INVENTORY_DESKS = {
	/** Dispensing issued prescriptions. */
	pharmacy: ['PHARMACIST', 'PHARMACY_ASSISTANT'],
	/** Receiving deliveries, adjusting and writing off stock, the item master and suppliers. */
	stock: ['INVENTORY_CLERK'],
	/** Reading stock, lots, the ledger and the alerts. */
	read: ['PHARMACIST', 'PHARMACY_ASSISTANT', 'INVENTORY_CLERK'],
	/** Recording supplies used on a visit (procedures, the lab). */
	consumption: [
		'PHARMACIST',
		'PHARMACY_ASSISTANT',
		'INVENTORY_CLERK',
		'DOCTOR',
		'NURSE',
		'MIDWIFE',
		'MEDTECH',
		'RADTECH',
	],
} as const satisfies Record<string, readonly StaffRole[]>;

export type InventoryDesk = keyof typeof INVENTORY_DESKS;

const DESK_NAMES: Record<InventoryDesk, string> = {
	pharmacy: 'pharmacy',
	stock: 'stock room',
	read: 'pharmacy and stock room',
	consumption: 'clinical staff',
};

/** Whether the actor works the desk (clinic admins work every desk). */
export function worksInventoryDesk(actor: Pick<ClinicActor, 'userRole' | 'staffRoles'>, desk: InventoryDesk): boolean {
	return (
		actor.userRole === 'admin' ||
		actor.staffRoles.some((role) => (INVENTORY_DESKS[desk] as readonly string[]).includes(role))
	);
}

/**
 * Desk checks outside a resolver's `@ClinicAccess` (Wise's read tools): the user holds one of the desk's roles at the
 * clinic, or is its admin. Row-level security still bounds what they reach.
 */
@Injectable()
export class InventoryAccess {
	constructor(private readonly access: AccessService) {}

	/** The user as a `ClinicActor` of the clinic when they work the desk there; else the desk error. */
	async atClinic(userId: string, clinicId: string, desk: InventoryDesk): Promise<ClinicActor> {
		const grant = (await this.access.listUserClinics(userId)).find(({ clinic }) => clinic.id === clinicId);
		const actor: ClinicActor | null = grant
			? {
					userId,
					clinicId: grant.clinic.id,
					clinicCode: grant.clinic.code,
					organizationId: grant.clinic.organizationId,
					userRole: grant.userRole,
					staffRoles: grant.staffRoles,
				}
			: null;
		if (!actor || !worksInventoryDesk(actor, desk)) {
			throw new InventoryDeskAccessError(DESK_NAMES[desk]);
		}
		return actor;
	}
}
