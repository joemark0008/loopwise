import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { dateColumn, text } from '../../../common/input-values.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../../audit/audit-changes.js';
import type { ClinicActor } from '../../clinics/clinic-admin-actor.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { type Practitioner, toPractitioner } from '../models/practitioner.model.js';
import { PractitionerRepository } from '../practitioner.repository.js';
import {
	PractitionerUserNotAtClinicError,
	PractitionerUserTakenError,
	PrcLicenseTakenError,
} from '../practitioners.errors.js';
import { toPractitionerLeave } from '../schedules/models/practitioner-availability.model.js';
import { PractitionerScheduleRepository } from '../schedules/practitioner-schedule.repository.js';
import { toWeeklySession } from '../schedules/practitioner-schedule.service.js';
import type { SavePractitionerInput, SetPractitionerClinicInput } from './dto/practitioner-setup.input.js';
import type {
	ClinicPractitioner,
	PractitionerScheduleEntry,
	PractitionerUserOption,
} from './models/clinic-practitioner.model.js';
import { type ClinicPractitionerRow, PractitionerSetupRepository } from './practitioner-setup.repository.js';

/**
 * Settings → Clinic → Practitioners (clinic admins): the practitioners who hold clinic here, their profile (PRC, PTR,
 * S2, PhilHealth PAN, TIN, e-signature), room and consult fee. A practitioner edits their own profile under row-level
 * security; an admin's edit of someone else's is system work, kept to the practitioners linked to the admin's clinic
 * and audited with the admin as the user.
 */
@Injectable()
export class PractitionerSetupService {
	private readonly logger = new Logger(PractitionerSetupService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly setup: PractitionerSetupRepository,
		private readonly practitioners: PractitionerRepository,
		private readonly schedules: PractitionerScheduleRepository,
		private readonly audit: AuditService,
	) {}

	/** The clinic's practitioners, active or not, by name, with their weekly hours and upcoming leaves. */
	list(actor: ClinicActor, now: Date = new Date()): Promise<ClinicPractitioner[]> {
		return this.db.asUser(actor.userId, async (tx) => {
			const links = await this.setup.listAtClinic(tx, actor.clinicId);
			const schedules = await this.schedules.listSchedules(tx, { clinicId: actor.clinicId });
			const leaves = await this.schedules.listLeavesFrom(
				tx,
				links.map((link) => link.practitionerId),
				now,
			);
			return links.map((link) => ({
				...toClinicPractitioner(link),
				schedules: schedules
					.filter((row) => row.practitionerId === link.practitionerId)
					.map((row) => toScheduleEntry(row.practitionerId, row)),
				leaves: leaves.filter((row) => row.practitionerId === link.practitionerId).map(toPractitionerLeave),
			}));
		});
	}

	/** Users of the clinic without a practitioner profile, who a new practitioner can sign in as. */
	userOptions(actor: ClinicActor): Promise<PractitionerUserOption[]> {
		return this.db.asUser(actor.userId, (tx) => this.setup.listUsersWithoutProfile(tx, actor.clinicId));
	}

	/**
	 * Adds a practitioner (linked to the clinic) or updates one linked to it. The PRC license is unique
	 * (PRC_LICENSE_TAKEN); the sign-in user must hold a role at the clinic and have no other profile.
	 */
	async save(actor: ClinicActor, input: SavePractitionerInput): Promise<Practitioner> {
		const prcLicenseNo = input.prcLicenseNo.trim();
		try {
			return await this.db.asSystem(async (tx) => {
				const current = input.id ? await this.setup.findLink(tx, input.id, actor.clinicId) : null;
				if (input.id && !current) {
					throw new EntityNotFoundError('Practitioner', input.id);
				}
				const userId = input.userId ?? null;
				if (userId) {
					const user = await this.setup.userAtClinic(tx, userId, actor.clinicId);
					if (!user?.atClinic) {
						throw new PractitionerUserNotAtClinicError();
					}
					if (user.practitionerId && user.practitionerId !== input.id) {
						throw new PractitionerUserTakenError();
					}
				}
				const data = {
					userId,
					type: input.type ?? current?.practitioner.type ?? 'PHYSICIAN',
					title: text(input.title),
					firstName: input.firstName.trim(),
					middleName: text(input.middleName),
					lastName: input.lastName.trim(),
					suffix: text(input.suffix),
					postNominals: text(input.postNominals),
					sex: input.sex ?? null,
					specialty: text(input.specialty),
					subspecialty: text(input.subspecialty),
					mobileNo: text(input.mobileNo),
					email: text(input.email),
					prcLicenseNo,
					prcLicenseExpiry: dateColumn(input.prcLicenseExpiry),
					ptrNo: text(input.ptrNo),
					ptrIssuedDate: dateColumn(input.ptrIssuedDate),
					ptrIssuedAt: text(input.ptrIssuedAt),
					s2LicenseNo: text(input.s2LicenseNo),
					s2LicenseExpiry: dateColumn(input.s2LicenseExpiry),
					philhealthPan: text(input.philhealthPan),
					philhealthPanExpiry: dateColumn(input.philhealthPanExpiry),
					tin: text(input.tin),
					signatureUrl: text(input.signatureUrl),
					isActive: input.isActive ?? current?.practitioner.isActive ?? true,
				} satisfies Prisma.PractitionerUncheckedUpdateInput;
				const row = current
					? await this.practitioners.update(tx, current.practitionerId, data)
					: await this.practitioners.create(tx, data);
				if (!current) {
					await this.practitioners.linkClinics(tx, row.id, [actor.clinicId]);
				}
				await this.audit.record(tx, {
					action: current ? 'UPDATE' : 'CREATE',
					event: current ? 'practitioner.update' : 'practitioner.create',
					entityType: 'Practitioner',
					entityId: row.id,
					userId: actor.userId,
					organizationId: actor.organizationId,
					clinicId: actor.clinicId,
					changes: current
						? auditChanges(withoutClinics(current.practitioner), withoutClinics(row))
						: { after: auditSnapshot(withoutClinics(row)) },
				});
				return toPractitioner((await this.practitioners.findById(tx, row.id)) ?? row);
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				this.logger.warn(`PRC license already on another profile (clinic ${actor.clinicId})`);
				throw new PrcLicenseTakenError(prcLicenseNo);
			}
			throw error;
		}
	}

	/** Sets the practitioner's room, consult fee and whether they hold clinic here now. Audited. */
	setClinicLink(actor: ClinicActor, input: SetPractitionerClinicInput): Promise<ClinicPractitioner> {
		return this.db.asUser(actor.userId, async (tx) => {
			const before = await this.setup.findLink(tx, input.practitionerId, actor.clinicId);
			if (!before) {
				throw new EntityNotFoundError('Practitioner', input.practitionerId);
			}
			const data = {
				roomName: text(input.roomName),
				consultFee: input.consultFee ?? null,
				isActive: input.isActive,
			};
			await this.setup.upsertLink(tx, input.practitionerId, actor.clinicId, data);
			await this.audit.updated(tx, {
				event: 'practitioner_clinic.update',
				entityType: 'PractitionerClinic',
				entityId: input.practitionerId,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: auditChanges(
					{
						roomName: before.roomName,
						consultFee: before.consultFee?.toNumber() ?? null,
						isActive: before.isActive,
					},
					data,
				),
			});
			const after = await this.setup.findLink(tx, input.practitionerId, actor.clinicId);
			const schedules = await this.schedules.listSchedules(tx, {
				clinicId: actor.clinicId,
				practitionerId: input.practitionerId,
			});
			const leaves = await this.schedules.listLeavesFrom(tx, [input.practitionerId], new Date());
			return {
				...toClinicPractitioner(after ?? before),
				schedules: schedules.map((row) => toScheduleEntry(row.practitionerId, row)),
				leaves: leaves.map(toPractitionerLeave),
			};
		});
	}
}

function toClinicPractitioner(link: ClinicPractitionerRow): Omit<ClinicPractitioner, 'schedules' | 'leaves'> {
	return {
		practitioner: toPractitioner(link.practitioner),
		roomName: link.roomName,
		consultFee: link.consultFee?.toNumber() ?? null,
		isActive: link.isActive,
	};
}

export function toScheduleEntry(
	practitionerId: string,
	row: Parameters<typeof toWeeklySession>[0],
): PractitionerScheduleEntry {
	const { id, dayOfWeek, startTime, endTime, slotMinutes, maxPatients } = toWeeklySession(row);
	return { id, practitionerId, dayOfWeek, startTime, endTime, slotMinutes, maxPatients };
}

function withoutClinics<T extends { clinics?: unknown }>(row: T): Omit<T, 'clinics'> {
	const { clinics: _clinics, ...rest } = row;
	return rest;
}
