import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import type { Encounter as EncounterRow } from '../../../generated/prisma/client.js';
import { toDateOnly } from '../../patients/parse-input.js';
import { physicalExamText } from '../../patients/patient-chart-summary.js';
import { Disposition, EncounterStatus, EncounterType } from '../encounters.enums.js';

@ObjectType({
	description: 'A visit of a patient at a clinic (DESIGN.md §5): the hub every clinical record hangs off.',
})
export class Encounter {
	@Field(() => ID)
	id: string;

	@Field({ description: "The clinic's visit number, e.g. TAG-ENC-2026-000012." })
	encounterNo: string;

	@Field(() => ID)
	patientId: string;

	@Field(() => ID)
	clinicId: string;

	@Field(() => EncounterType)
	type: EncounterType;

	@Field(() => EncounterStatus)
	status: EncounterStatus;

	@Field(() => ID, { nullable: true, description: 'The practitioner (doctor) of the visit.' })
	practitionerId: string | null;

	@Field(() => String, { nullable: true, description: 'The chief complaint.' })
	reason: string | null;

	@Field(() => String, { nullable: true })
	notes: string | null;

	@Field(() => String, { nullable: true, description: 'History of present illness (subjective).' })
	history: string | null;

	@Field(() => String, { nullable: true, description: 'Physical examination findings (objective).' })
	physicalExam: string | null;

	@Field(() => String, { nullable: true })
	assessment: string | null;

	@Field(() => String, { nullable: true })
	plan: string | null;

	@Field(() => String, { nullable: true })
	patientInstructions: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	followUpOn: string | null;

	@Field(() => Disposition, { nullable: true })
	disposition: Disposition | null;

	@Field()
	startedAt: Date;

	@Field(() => Date, { nullable: true })
	endedAt: Date | null;

	@Field(() => ID, { nullable: true, description: 'The chart chat Wise drafted it in, if any.' })
	sourceChatId: string | null;

	@Field(() => Int, {
		description: 'Moves on every change; pass it back as `expectedVersion` to refuse a stale edit.',
	})
	version: number;
}

export function toEncounter(row: EncounterRow): Encounter {
	return {
		id: row.id,
		encounterNo: row.encounterNo,
		patientId: row.patientId,
		clinicId: row.clinicId,
		type: row.type,
		status: row.status,
		practitionerId: row.practitionerId,
		reason: row.chiefComplaint,
		notes: row.notes,
		history: row.historyOfPresentIllness,
		physicalExam: physicalExamText(row.physicalExam),
		assessment: row.assessment,
		plan: row.plan,
		patientInstructions: row.patientInstructions,
		followUpOn: toDateOnly(row.followUpDate),
		disposition: row.disposition,
		startedAt: row.startedAt,
		endedAt: row.endedAt,
		sourceChatId: row.sourceChatId,
		version: row.version,
	};
}
