import type { StaffRole } from '@loopwise/shared/staff-roles';
import { Injectable } from '@nestjs/common';

import { AccessService, type ClinicAccessGrant } from '../../common/guards/access.service.js';
import { toClinicRef } from '../patients/care-clinic.service.js';
import type { ClinicRef } from '../patients/models/clinic-ref.model.js';
import { SchedulingDeskAccessError } from './scheduling.errors.js';

/** The desks of the front-desk flow and the clinic roles that work them; clinic admins work every desk. */
export const SCHEDULING_DESKS = {
	/** Booking, rescheduling, cancelling, checking in. */
	front_desk: ['RECEPTIONIST'],
	/** Calling patients to triage, vitals and the chief complaint, sending them to the doctor. */
	triage: ['NURSE', 'MIDWIFE'],
	/** The doctor's own line. */
	doctor: ['DOCTOR'],
	/** The cashier's line. */
	cashier: ['CASHIER', 'BILLING_CLERK'],
} as const satisfies Record<string, readonly StaffRole[]>;

export type SchedulingDesk = keyof typeof SCHEDULING_DESKS;

const DESK_NAMES: Record<SchedulingDesk, string> = {
	front_desk: 'front desk',
	triage: 'nurses',
	doctor: 'doctors',
	cashier: 'cashier',
};

/** Who is working which desk at the clinic. */
export interface DeskActor {
	userId: string;
	clinic: ClinicRef;
	isAdmin: boolean;
	staffRoles: readonly StaffRole[];
}

/**
 * Desk checks of the front-desk flow (DESIGN.md §8): the user holds one of the desk's roles at the clinic, or is its
 * admin. Row-level security still decides which patients they reach (front desk and nurses see the patients with an
 * appointment or a visit at their clinic; a doctor the patients in their care).
 */
@Injectable()
export class SchedulingAccess {
	constructor(private readonly access: AccessService) {}

	/** The user at the clinic, when they work there (any role but viewer); else the desk error. */
	async atClinic(userId: string, clinicId: string, desk?: SchedulingDesk): Promise<DeskActor> {
		const grant = (await this.access.listUserClinics(userId)).find(
			({ clinic, userRole }) => clinic.id === clinicId && userRole !== 'viewer',
		);
		if (!grant || (desk && !worksDesk(grant, desk))) {
			throw new SchedulingDeskAccessError(desk ? DESK_NAMES[desk] : 'staff');
		}
		return toActor(userId, grant);
	}

	/** Whether the actor works the desk (admins work every desk). */
	works(actor: DeskActor, desk: SchedulingDesk): boolean {
		return (
			actor.isAdmin ||
			actor.staffRoles.some((role) => (SCHEDULING_DESKS[desk] as readonly string[]).includes(role))
		);
	}

	/** The desk error unless the actor works one of `desks`. */
	require(actor: DeskActor, ...desks: SchedulingDesk[]): void {
		if (!desks.some((desk) => this.works(actor, desk))) {
			throw new SchedulingDeskAccessError(desks.map((desk) => DESK_NAMES[desk]).join(' or '));
		}
	}
}

function worksDesk(grant: ClinicAccessGrant, desk: SchedulingDesk): boolean {
	return (
		grant.userRole === 'admin' ||
		grant.staffRoles.some((role) => (SCHEDULING_DESKS[desk] as readonly string[]).includes(role))
	);
}

function toActor(userId: string, grant: ClinicAccessGrant): DeskActor {
	return {
		userId,
		clinic: toClinicRef(grant.clinic),
		isAdmin: grant.userRole === 'admin',
		staffRoles: grant.staffRoles,
	};
}
