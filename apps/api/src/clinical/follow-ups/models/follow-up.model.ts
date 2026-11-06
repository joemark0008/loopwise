import '../../encounters/encounters.enums.js';

import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { Disposition } from '../../../generated/prisma/enums.js';
import { practitionerDisplayName } from '../../practitioners/models/practitioner.model.js';
import type { FollowUpRow } from '../follow-up.repository.js';
import { type FollowUpTiming, followUpTiming } from '../follow-up-window.js';

export const FollowUpTimingEnum = { OVERDUE: 'OVERDUE', DUE: 'DUE', UPCOMING: 'UPCOMING' } as const;
registerEnumType(FollowUpTimingEnum, {
	name: 'FollowUpTiming',
	description: 'The follow-up date against today (Asia/Manila): passed, today, or within the days asked for.',
});

@ObjectType({
	description:
		'A visit whose follow-up date is due, overdue or coming up, not yet followed by a visit or booking with its doctor.',
})
export class FollowUp {
	@Field(() => ID, { description: 'The visit that set the follow-up.' })
	encounterId: string;

	@Field()
	encounterNo: string;

	@Field(() => ID)
	clinicId: string;

	@Field(() => ID)
	patientId: string;

	@Field()
	patientName: string;

	@Field()
	patientNo: string;

	@Field(() => String, { nullable: true })
	mobileNo: string | null;

	@Field(() => ID, { nullable: true, description: 'The doctor of the visit: the one to book the follow-up with.' })
	practitionerId: string | null;

	@Field(() => String, { nullable: true })
	doctorName: string | null;

	@Field({ description: 'When the visit was.' })
	visitedAt: Date;

	@Field({ description: 'YYYY-MM-DD: the date the doctor set (the suggested booking date).' })
	followUpDate: string;

	@Field(() => Disposition, { nullable: true })
	disposition: Disposition | null;

	@Field(() => String, { nullable: true, description: 'The chief complaint of the visit.' })
	reason: string | null;

	@Field(() => String, { nullable: true, description: 'The primary (else first) diagnosis of the visit.' })
	diagnosis: string | null;

	@Field(() => FollowUpTimingEnum)
	timing: FollowUpTiming;

	@Field(() => Int, { description: 'Days from today to the follow-up date; negative when overdue.' })
	daysFromToday: number;
}

export function toFollowUp(row: FollowUpRow, today: string): FollowUp {
	const followUpDate = row.followUpDate!.toISOString().slice(0, 10);
	const diagnosis = row.diagnosis.find((entry) => entry.type === 'PRIMARY') ?? row.diagnosis[0];
	return {
		encounterId: row.id,
		encounterNo: row.encounterNo,
		clinicId: row.clinicId,
		patientId: row.patient.id,
		patientName: [row.patient.firstName, row.patient.middleName, row.patient.lastName].filter(Boolean).join(' '),
		patientNo: row.patient.patientNo,
		mobileNo: row.patient.mobileNo,
		practitionerId: row.practitionerId,
		doctorName: row.practitioner ? practitionerDisplayName(row.practitioner) : null,
		visitedAt: row.startedAt,
		followUpDate,
		disposition: row.disposition,
		reason: row.chiefComplaint,
		diagnosis: diagnosis ? `${diagnosis.icd10Code ?? ''} ${diagnosis.description}`.trim() : null,
		...followUpTiming(followUpDate, today),
	};
}
