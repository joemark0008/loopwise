import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import { Practitioner } from '../../models/practitioner.model.js';
import { PractitionerLeave } from '../../schedules/models/practitioner-availability.model.js';

@ObjectType({ description: 'A weekly clinic session of a practitioner (Philippine time).' })
export class PractitionerScheduleEntry {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	practitionerId: string;

	@Field(() => Int, { description: '0 = Sunday … 6 = Saturday.' })
	dayOfWeek: number;

	@Field({ description: 'HH:MM.' })
	startTime: string;

	@Field({ description: 'HH:MM.' })
	endTime: string;

	@Field(() => Int)
	slotMinutes: number;

	@Field(() => Int, { nullable: true, description: 'Cap of patients for the session; null = no cap.' })
	maxPatients: number | null;
}

@ObjectType({ description: 'A practitioner at the selected clinic: room, fee, weekly hours and upcoming leaves.' })
export class ClinicPractitioner {
	@Field(() => Practitioner)
	practitioner: Practitioner;

	@Field(() => String, { nullable: true, description: '"Room 203".' })
	roomName: string | null;

	@Field(() => Float, { nullable: true, description: 'Consultation fee at this clinic (pesos); else the default.' })
	consultFee: number | null;

	@Field({ description: 'Holds clinic here now.' })
	isActive: boolean;

	@Field(() => [PractitionerScheduleEntry])
	schedules: PractitionerScheduleEntry[];

	@Field(() => [PractitionerLeave], { description: 'Leaves that have not ended yet.' })
	leaves: PractitionerLeave[];
}

@ObjectType({ description: 'A user of the clinic who could sign in as a new practitioner (no profile yet).' })
export class PractitionerUserOption {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field()
	email: string;

	@Field()
	firstName: string;

	@Field()
	lastName: string;
}
