import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { PractitionerService } from '../practitioners/practitioner.service.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import { manilaDate } from '../scheduling/manila-time.js';
import { type DeskActor, SchedulingAccess } from '../scheduling/scheduling-access.js';
import type { FollowUpsInput } from './dto/follow-ups.input.js';
import { FollowUpRepository } from './follow-up.repository.js';
import { followUpWindow } from './follow-up-window.js';
import { FollowUpsAccessError } from './follow-ups.errors.js';
import { type FollowUp, toFollowUp } from './models/follow-up.model.js';

/** Whose follow-ups a user lists at a clinic. */
type FollowUpScope = 'admin' | 'front_desk' | 'doctor';

/**
 * The follow-up list (DESIGN.md §6): visits whose `follow_up_date` is overdue, due today or within the days asked for,
 * with their disposition, until the patient has a later visit or a standing booking with the same doctor. Computed
 * live from the visits and bookings on every read (no stored list and no job: the list can never be stale).
 *
 * Who sees what: a doctor their own patients' follow-ups (read as the user, row-level security); the front desk
 * (RECEPTIONIST) the clinic's, optionally one doctor's, to book them (as the user: desk roles see the patients with a
 * visit at their clinic); a clinic admin every follow-up of the clinic, read as system work after the admin check
 * (admins hold no care relationship of their own). Each list is audited as a view. Booking is Scheduling's
 * `bookAppointment`; nothing here messages a patient.
 */
@Injectable()
export class FollowUpService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly followUps: FollowUpRepository,
		private readonly access: SchedulingAccess,
		private readonly practitioners: PractitionerService,
		private readonly audit: AuditService,
	) {}

	async list(userId: string, input: FollowUpsInput & { patientId?: string | null }): Promise<FollowUp[]> {
		const actor = await this.access.atClinic(userId, input.clinicId);
		const scope = this.scopeOf(actor);
		const today = manilaDate();
		const window = followUpWindow(today, input);
		const read = async (tx: ClinicalTx, practitionerId: string | null | undefined) => {
			const rows = await this.followUps.listDue(tx, {
				clinicId: actor.clinic.id,
				...window,
				practitionerId,
				patientId: input.patientId,
			});
			await this.audit.view(tx, {
				event: 'follow_up.list',
				entityType: 'Encounter',
				userId,
				patientId: input.patientId ?? null,
				organizationId: actor.clinic.organizationId,
				clinicId: actor.clinic.id,
				reason: scope === 'admin' ? 'Follow-ups (clinic admin)' : null,
			});
			return rows.map((row) => toFollowUp(row, today));
		};
		if (scope === 'admin') {
			return this.db.asSystem((tx) => read(tx, input.practitionerId));
		}
		return this.db.asUser(userId, async (tx) => {
			if (scope === 'front_desk') {
				return read(tx, input.practitionerId);
			}
			const mine = await this.practitioners.findIdForUser(tx, userId);
			// No practitioner profile: no follow-ups of one's own (never every doctor's).
			return mine ? read(tx, mine) : [];
		});
	}

	/** Admins see the clinic's every follow-up, the front desk the clinic's, a doctor their own; nobody else. */
	private scopeOf(actor: DeskActor): FollowUpScope {
		if (actor.isAdmin) {
			return 'admin';
		}
		if (actor.staffRoles.includes('RECEPTIONIST')) {
			return 'front_desk';
		}
		if (actor.staffRoles.includes('DOCTOR')) {
			return 'doctor';
		}
		throw new FollowUpsAccessError();
	}
}
