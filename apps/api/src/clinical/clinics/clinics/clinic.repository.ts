import type { CustomBoundarySet, MapSettings } from '@loopwise/shared';
import type { DisplaySettings } from '@loopwise/shared/date';
import { DEFAULT_DATE_FORMAT_SETTINGS } from '@loopwise/shared/date';
import { toUserRole } from '@loopwise/shared/staff-roles';
import type { UserRole } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import { HandlerError } from '../../../common/errors/handler-error.js';
import { ConfigService } from '../../../config/config.service.js';
import type { Clinic, Prisma, StaffRole } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { DbExecutor } from '../../../prisma/prisma.types.js';
import { clinicCodeFromName } from './clinic-code.js';
import { defaultUserGroupValues } from './default-user-group.js';

/** A new clinic; `code` is derived from the name (unique in the organization) when left out. */
export type NewClinic = Omit<Prisma.ClinicUncheckedCreateInput, 'code'> & { code?: string };

/** A user who can open a clinic, with their access level and their roles there. */
export interface ClinicUser {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	staffRoles: StaffRole[];
}

/** `clinics` and `user_clinic_roles`: lookup, creation, staff roles and the clinic's settings columns. */
@Injectable()
export class ClinicRepository {
	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
	) {}

	getClinicById(clinicId: string): Promise<Clinic | null> {
		return this.prisma.clinic.findUnique({ where: { id: clinicId } });
	}

	getClinicByPath(path: string, executor: DbExecutor = this.prisma): Promise<Clinic | null> {
		return executor.clinic.findFirst({ where: { path }, orderBy: { createdAt: 'asc' } });
	}

	/** Creates a clinic together with its default "All Users" group, giving it a code when it has none. */
	async createClinic(clinic: NewClinic, executor?: Prisma.TransactionClient): Promise<Clinic> {
		const create = async (tx: Prisma.TransactionClient) => {
			const code = clinic.code ?? (await this.nextClinicCode(tx, clinic.organizationId, clinic.name));
			const created = await tx.clinic.create({ data: { ...clinic, code } });
			await tx.userGroup.create({ data: defaultUserGroupValues(created.id) });
			return created;
		};
		return executor ? create(executor) : this.prisma.$transaction(create);
	}

	/** Adds the roles the user doesn't hold yet at the clinic. */
	async grantClinicRoles(
		clinicId: string,
		userId: string,
		roles: readonly StaffRole[],
		executor: DbExecutor = this.prisma,
	): Promise<void> {
		await executor.userClinicRole.createMany({
			data: roles.map((role) => ({ clinicId, userId, role })),
			skipDuplicates: true,
		});
	}

	/** Replaces the user's roles at the clinic with `roles` (none: the user leaves the clinic). */
	async setClinicRoles(clinicId: string, userId: string, roles: readonly StaffRole[]): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.userClinicRole.deleteMany({ where: { clinicId, userId, role: { notIn: [...roles] } } });
			await this.grantClinicRoles(clinicId, userId, roles, tx);
		});
	}

	/** The user's roles at the clinic (`user_clinic_roles`). */
	async getStaffRoles(clinicId: string, userId: string, executor: DbExecutor = this.prisma): Promise<StaffRole[]> {
		const rows = await executor.userClinicRole.findMany({ where: { clinicId, userId }, select: { role: true } });
		return rows.map(({ role }) => role);
	}

	async getDefaultClinic(): Promise<Clinic | null> {
		const clinicPath = this.config.env.LOOPWISE_DEFAULT_CLINIC_PATH;
		if (clinicPath) {
			return this.getClinicByPath(clinicPath);
		}
		return this.prisma.clinic.findFirst({ orderBy: { createdAt: 'asc' } });
	}

	/** Renames unless another clinic of the organization already has the name (`renameClinic`). */
	renameClinic(clinicId: string, organizationId: string, name: string): Promise<boolean> {
		return this.prisma.$transaction(async (tx) => {
			const conflict = await tx.clinic.findFirst({
				where: { organizationId, name: { equals: name, mode: 'insensitive' }, id: { not: clinicId } },
				select: { id: true },
			});
			if (conflict) {
				return false;
			}
			await tx.clinic.update({ where: { id: clinicId }, data: { name } });
			return true;
		});
	}

	async isClinicNameTaken(organizationId: string, name: string): Promise<boolean> {
		const clinic = await this.prisma.clinic.findFirst({
			where: { organizationId, name: { equals: name, mode: 'insensitive' } },
			select: { id: true },
		});
		return clinic !== null;
	}

	updateClinic(clinicId: string, data: Prisma.ClinicUncheckedUpdateInput): Promise<Clinic> {
		return this.prisma.clinic.update({ where: { id: clinicId }, data });
	}

	async deleteClinic(clinicId: string): Promise<void> {
		await this.prisma.clinic.delete({ where: { id: clinicId } });
	}

	/** The users holding a role at the clinic (`user_clinic_roles`), with their access level there. */
	async listClinicMembersWithRoles(clinicId: string): Promise<ClinicUser[]> {
		return (await this.listClinicUsers(clinicId, false)).filter((user) => user.staffRoles.length > 0);
	}

	/** Users with a role at the clinic or a membership of its organization (an organization admin manages every clinic). */
	listUsersWithClinicAccess(clinicId: string): Promise<ClinicUser[]> {
		return this.listClinicUsers(clinicId, true);
	}

	/** Upstream `getDisplaySettings`: the clinic's date format, defaulted. */
	async getDisplaySettings(clinicId: string): Promise<DisplaySettings> {
		const clinic = await this.getClinicById(clinicId);
		const stored = (clinic?.displaySettings ?? {}) as DisplaySettings;
		return { dateFormat: stored.dateFormat ?? { ...DEFAULT_DATE_FORMAT_SETTINGS } };
	}

	/** Upstream `updateDisplaySettings`: merges into the stored settings, keeping the date format when not given. */
	async updateDisplaySettings(clinicId: string, settings: DisplaySettings): Promise<DisplaySettings> {
		const current = await this.getDisplaySettings(clinicId);
		const next: DisplaySettings = {
			...current,
			...settings,
			dateFormat: settings.dateFormat ?? current.dateFormat,
		};
		await this.prisma.clinic.update({
			where: { id: clinicId },
			data: { displaySettings: next as unknown as Prisma.InputJsonValue },
		});
		return next;
	}

	async getMapSettings(clinicId: string): Promise<MapSettings> {
		const clinic = await this.getClinicById(clinicId);
		return (clinic?.mapSettings ?? {}) as MapSettings;
	}

	/** The clinic's custom GeoJSON boundary sets (`clinics.map_settings.customBoundaries`). */
	async getCustomBoundaries(clinicId: string): Promise<CustomBoundarySet[]> {
		const settings = await this.getMapSettings(clinicId);
		return settings.customBoundaries ?? [];
	}

	addCustomBoundary(clinicId: string, boundary: CustomBoundarySet): Promise<CustomBoundarySet[]> {
		return this.mutateCustomBoundaries(clinicId, (current) => {
			if (current.some((b) => b.key === boundary.key)) {
				throw new HandlerError('BAD_REQUEST', `A boundary set with key "${boundary.key}" already exists.`);
			}
			return [...current, boundary];
		});
	}

	updateCustomBoundary(
		clinicId: string,
		key: string,
		patch: Partial<CustomBoundarySet>,
	): Promise<CustomBoundarySet[]> {
		return this.mutateCustomBoundaries(clinicId, (current) => {
			if (patch.key && patch.key !== key && current.some((b) => b.key === patch.key)) {
				throw new HandlerError('BAD_REQUEST', `A boundary set with key "${patch.key}" already exists.`);
			}
			return current.map((b) => (b.key === key ? { ...b, ...patch } : b));
		});
	}

	deleteCustomBoundary(clinicId: string, key: string): Promise<CustomBoundarySet[]> {
		return this.mutateCustomBoundaries(clinicId, (current) => current.filter((b) => b.key !== key));
	}

	private async nextClinicCode(tx: Prisma.TransactionClient, organizationId: string, name: string): Promise<string> {
		const rows = await tx.clinic.findMany({ where: { organizationId }, select: { code: true } });
		return clinicCodeFromName(name, new Set(rows.map(({ code }) => code)));
	}

	private async listClinicUsers(clinicId: string, withOrganization: boolean): Promise<ClinicUser[]> {
		const inOrganization = { organization: { clinics: { some: { id: clinicId } } } };
		const users = await this.prisma.user.findMany({
			where: {
				OR: [
					{ clinicRoles: { some: { clinicId } } },
					...(withOrganization ? [{ organizationMembers: { some: inOrganization } }] : []),
				],
			},
			select: {
				id: true,
				name: true,
				email: true,
				clinicRoles: { where: { clinicId }, select: { role: true } },
				organizationMembers: { where: inOrganization, select: { role: true } },
			},
			orderBy: { name: 'asc' },
		});
		return users.flatMap(({ clinicRoles, organizationMembers, ...user }) => {
			const staffRoles = clinicRoles.map(({ role }) => role);
			const role = toUserRole(staffRoles, withOrganization ? organizationMembers[0]?.role : null);
			return role ? [{ ...user, role, staffRoles }] : [];
		});
	}

	/** Read-modify-write of `map_settings` under a row lock, so concurrent edits don't drop each other's sets. */
	private mutateCustomBoundaries(
		clinicId: string,
		transform: (current: CustomBoundarySet[]) => CustomBoundarySet[],
	): Promise<CustomBoundarySet[]> {
		return this.prisma.$transaction(async (tx) => {
			const [row] = await tx.$queryRaw<{ mapSettings: MapSettings | null }[]>`
				SELECT map_settings AS "mapSettings" FROM clinics WHERE id = ${clinicId}::uuid FOR UPDATE`;
			const settings = row?.mapSettings ?? {};
			const next = transform(settings.customBoundaries ?? []);
			await tx.clinic.update({
				where: { id: clinicId },
				data: { mapSettings: { ...settings, customBoundaries: next } as unknown as Prisma.InputJsonValue },
			});
			return next;
		});
	}
}
