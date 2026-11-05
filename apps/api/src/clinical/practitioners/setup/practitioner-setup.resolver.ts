import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAdmin } from '../../../common/decorators/access.decorator.js';
import { type ClinicActor, CurrentClinicActor } from '../../clinics/clinic-admin-actor.js';
import { Practitioner } from '../models/practitioner.model.js';
import { PractitionerLeave } from '../schedules/models/practitioner-availability.model.js';
import { PractitionerScheduleAdminService } from '../schedules/practitioner-schedule-admin.service.js';
import {
	AddPractitionerLeaveInput,
	PractitionerScheduleInput,
	SavePractitionerInput,
	SetPractitionerClinicInput,
} from './dto/practitioner-setup.input.js';
import {
	ClinicPractitioner,
	PractitionerScheduleEntry,
	PractitionerUserOption,
} from './models/clinic-practitioner.model.js';
import { PractitionerSetupService } from './practitioner-setup.service.js';

/** Settings → Clinic → Practitioners (clinic admins of the selected clinic; every change audited). */
@Resolver(() => ClinicPractitioner)
export class PractitionerSetupResolver {
	constructor(
		private readonly setup: PractitionerSetupService,
		private readonly schedules: PractitionerScheduleAdminService,
	) {}

	@ClinicAdmin()
	@Query(() => [ClinicPractitioner], {
		description: 'Every practitioner linked to the selected clinic, with room, fee, weekly hours and leaves.',
	})
	clinicPractitionerSetup(@CurrentClinicActor() actor: ClinicActor): Promise<ClinicPractitioner[]> {
		return this.setup.list(actor);
	}

	@ClinicAdmin()
	@Query(() => [PractitionerUserOption], {
		description: 'Users of the selected clinic without a practitioner profile (who a new one can sign in as).',
	})
	practitionerUserOptions(@CurrentClinicActor() actor: ClinicActor): Promise<PractitionerUserOption[]> {
		return this.setup.userOptions(actor);
	}

	@ClinicAdmin()
	@Mutation(() => Practitioner, { description: 'Adds a practitioner to the selected clinic, or updates one there.' })
	savePractitioner(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: SavePractitionerInput,
	): Promise<Practitioner> {
		return this.setup.save(actor, input);
	}

	@ClinicAdmin()
	@Mutation(() => ClinicPractitioner, { description: "Sets a practitioner's room, fee and status at the clinic." })
	setPractitionerClinic(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: SetPractitionerClinicInput,
	): Promise<ClinicPractitioner> {
		return this.setup.setClinicLink(actor, input);
	}

	@ClinicAdmin()
	@Mutation(() => PractitionerScheduleEntry, { description: 'Adds or changes a weekly session at the clinic.' })
	savePractitionerSchedule(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: PractitionerScheduleInput,
	): Promise<PractitionerScheduleEntry> {
		return this.schedules.saveSchedule(actor, input);
	}

	@ClinicAdmin()
	@Mutation(() => Boolean, { description: 'Removes a weekly session of the clinic.' })
	removePractitionerSchedule(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('id', { type: () => ID }) id: string,
	): Promise<boolean> {
		return this.schedules.removeSchedule(actor, id);
	}

	@ClinicAdmin()
	@Mutation(() => PractitionerLeave, { description: 'Adds a leave of a practitioner who holds clinic here.' })
	addPractitionerLeave(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: AddPractitionerLeaveInput,
	): Promise<PractitionerLeave> {
		return this.schedules.addLeave(actor, input);
	}

	@ClinicAdmin()
	@Mutation(() => Boolean, { description: 'Removes a leave.' })
	removePractitionerLeave(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('id', { type: () => ID }) id: string,
	): Promise<boolean> {
		return this.schedules.removeLeave(actor, id);
	}
}
