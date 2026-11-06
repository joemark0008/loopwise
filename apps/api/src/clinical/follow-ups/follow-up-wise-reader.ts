import type { listFollowUps, listReferrals } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { ReferralListService } from '../documents/referrals/referral-list.service.js';
import { InvalidInputError } from '../patients/patients.errors.js';
import type { Practitioner } from '../practitioners/models/practitioner.model.js';
import { PractitionerService } from '../practitioners/practitioner.service.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { manilaDate } from '../scheduling/manila-time.js';
import { SchedulingAccess } from '../scheduling/scheduling-access.js';
import { FollowUpService } from './follow-up.service.js';
import { DEFAULT_WITHIN_DAYS } from './follow-up-window.js';

/** Referrals still waiting on someone: an answer (SENT) or the completion (ACCEPTED). */
const PENDING = ['SENT', 'ACCEPTED'] as const;

/**
 * The reads behind Wise's `list_follow_ups` ("follow-ups due this week") and `list_referrals` ("my pending
 * referrals"), as the user: the same lists and access as the Follow-ups and Referrals pages, each audited with Wise as
 * the reason. Booking a follow-up is the front desk's `propose_appointment` card, confirmed by them; answering a
 * referral is the Referrals page's dialog. Nothing here writes or messages a patient.
 */
@Injectable()
export class FollowUpWiseReader {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly followUps: FollowUpService,
		private readonly referrals: ReferralListService,
		private readonly practitioners: PractitionerService,
		private readonly access: SchedulingAccess,
		private readonly audit: AuditService,
	) {}

	async followUpsForWise(
		userId: string,
		clinicId: string | null,
		input: listFollowUps.Input & { patientId?: string | null; limit: number },
	): Promise<Omit<listFollowUps.Output, '_version'>> {
		const actor = await this.access.atClinic(userId, requireClinic(clinicId));
		const doctor = input.doctor?.trim()
			? matchDoctor(await this.practitioners.listAtClinic(userId, actor.clinic.id), input.doctor)
			: null;
		const withinDays = input.withinDays ?? DEFAULT_WITHIN_DAYS;
		const rows = await this.followUps.list(userId, {
			clinicId: actor.clinic.id,
			practitionerId: doctor?.id,
			withinDays,
			patientId: input.patientId ?? null,
		});
		return {
			clinicName: actor.clinic.name,
			today: manilaDate(),
			withinDays,
			doctor: doctor?.displayName ?? null,
			followUps: rows.slice(0, input.limit).map((row) => ({
				encounterId: row.encounterId,
				encounterNo: row.encounterNo,
				patient: { id: row.patientId, name: row.patientName, patientNo: row.patientNo },
				doctor: row.practitionerId ? { id: row.practitionerId, name: row.doctorName ?? '' } : null,
				visitDate: row.visitedAt.toISOString(),
				followUpDate: row.followUpDate,
				timing: row.timing,
				daysFromToday: row.daysFromToday,
				disposition: row.disposition,
				reason: row.reason,
				diagnosis: row.diagnosis,
			})),
			truncated: rows.length > input.limit,
		};
	}

	async referralsForWise(
		userId: string,
		input: listReferrals.Input & { limit: number },
	): Promise<Omit<listReferrals.Output, '_version'>> {
		const box = input.box ?? 'inbox';
		const rows = await this.referrals.list(userId, {
			box: box === 'inbox' ? 'INBOX' : 'OUTBOX',
			statuses: input.includeClosed ? null : [...PENDING],
		});
		const people = await this.db.asUser(userId, async (tx) => {
			const ids = [
				...new Set(
					rows.flatMap((row) =>
						row.toPractitionerId
							? [row.fromPractitionerId, row.toPractitionerId]
							: [row.fromPractitionerId],
					),
				),
			];
			const found = await this.practitioners.findManyByIds(tx, ids);
			await this.audit.view(tx, {
				event: 'referral.list',
				entityType: 'Referral',
				userId,
				reason: 'Wise list_referrals',
			});
			return new Map(found.map((practitioner) => [practitioner.id, practitioner.displayName]));
		});
		return {
			box,
			referrals: rows.slice(0, input.limit).map((row) => ({
				id: row.id,
				status: row.status,
				urgency: row.urgency,
				referredAt: row.referredAt.toISOString(),
				patient: { id: row.patientId, name: row.patientName, patientNo: row.patientNo },
				encounterNo: row.encounterNo,
				counterpart:
					box === 'inbox'
						? (people.get(row.fromPractitionerId) ?? 'A colleague')
						: row.toPractitionerId
							? (people.get(row.toPractitionerId) ?? 'A colleague')
							: [row.toExternalDoctor, row.toFacility].filter(Boolean).join(', '),
				isInternal: row.isInternal,
				specialty: row.specialty,
				reason: row.reason,
				responseNotes: row.responseNotes,
			})),
			truncated: rows.length > input.limit,
		};
	}
}

function requireClinic(clinicId: string | null): string {
	if (!clinicId) {
		throw new InvalidInputError('This chat has no clinic. Open Wise from one of your clinics.');
	}
	return clinicId;
}

/** The one doctor of the clinic whose name has every word given; else the list to ask from. */
function matchDoctor(doctors: Practitioner[], words: string): Practitioner {
	const wanted = words
		.toLowerCase()
		.replace(/\b(dra?|doctor|doc)\.?\s+/g, '')
		.split(/\s+/)
		.filter(Boolean);
	const matches = doctors.filter((doctor) => wanted.every((word) => doctor.displayName.toLowerCase().includes(word)));
	if (matches.length !== 1) {
		throw new InvalidInputError(
			`${matches.length === 0 ? 'No' : 'More than one'} doctor at this clinic matches "${words}". ` +
				`The clinic's doctors are: ${doctors.map((doctor) => doctor.displayName).join(', ') || 'none'}.`,
		);
	}
	return matches[0];
}
