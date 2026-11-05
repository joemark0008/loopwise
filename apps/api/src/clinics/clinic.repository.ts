import type { CustomBoundarySet, MapSettings } from '@loopwise/shared';
import type { DisplaySettings } from '@loopwise/shared/date';
import { DEFAULT_DATE_FORMAT_SETTINGS } from '@loopwise/shared/date';
import type { UserRole } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import { HandlerError } from '../common/errors/handler-error.js';
import { ConfigService } from '../config/config.service.js';
import type { Clinic, ClinicMember, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DbExecutor } from '../prisma/prisma.types.js';
import { defaultUserGroupValues } from './default-user-group.js';

/** Port of upstream `queries/clinic.queries.ts` (the part Phase 1 needs: lookup, membership, roles). */
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
		return executor.clinic.findFirst({ where: { path } });
	}

	/** Creates a clinic together with its default "All Users" group. */
	async createClinic(
		clinic: Prisma.ClinicUncheckedCreateInput,
		executor?: Prisma.TransactionClient,
	): Promise<Clinic> {
		const create = async (tx: Prisma.TransactionClient) => {
			const created = await tx.clinic.create({ data: clinic });
			await tx.userGroup.create({ data: defaultUserGroupValues(created.id) });
			return created;
		};
		return executor ? create(executor) : this.prisma.$transaction(create);
	}

	getClinicMember(
		clinicId: string,
		userId: string,
		executor: DbExecutor = this.prisma,
	): Promise<ClinicMember | null> {
		return executor.clinicMember.findUnique({ where: { clinicId_userId: { clinicId, userId } } });
	}

	addClinicMember(
		member: Prisma.ClinicMemberUncheckedCreateInput,
		executor: DbExecutor = this.prisma,
	): Promise<ClinicMember> {
		return executor.clinicMember.create({ data: member });
	}

	async getDefaultClinic(): Promise<Clinic | null> {
		const clinicPath = this.config.env.LOOPWISE_DEFAULT_CLINIC_PATH;
		if (clinicPath) {
			return this.getClinicByPath(clinicPath);
		}
		return this.prisma.clinic.findFirst();
	}

	/**
	 * The clinic a request works on. loopwise is self-hosted but has several clinics (upstream's cloud mode):
	 * the selected clinic when the user can access it, else the default clinic (`LOOPWISE_DEFAULT_CLINIC_PATH`)
	 * when the user has a role in it, else the user's first clinic.
	 */
	async getClinicByUserId(userId: string, selectedClinicId?: string | null): Promise<Clinic | null> {
		const clinics = await this.listUserClinicsWithRoles(userId);
		if (selectedClinicId) {
			const selected = clinics.find(({ clinic }) => clinic.id === selectedClinicId);
			if (selected) {
				return selected.clinic;
			}
		}
		const defaultClinic = await this.getDefaultClinic();
		if (defaultClinic && clinics.some(({ clinic }) => clinic.id === defaultClinic.id)) {
			return defaultClinic;
		}
		return clinics[0]?.clinic ?? null;
	}

	/** Clinics the user reaches through a clinic membership or their organization (`listUserClinicsWithRoles`). */
	async listUserClinicsWithRoles(userId: string): Promise<{ clinic: Clinic; userRole: UserRole }[]> {
		const clinics = await this.prisma.clinic.findMany({
			where: {
				OR: [{ clinicMembers: { some: { userId } } }, { organization: { orgMembers: { some: { userId } } } }],
			},
			include: {
				clinicMembers: { where: { userId }, select: { role: true } },
				organization: { select: { orgMembers: { where: { userId }, select: { role: true } } } },
			},
			orderBy: { name: 'asc' },
		});
		return clinics.map(({ clinicMembers, organization, ...clinic }) => ({
			clinic,
			userRole: (clinicMembers[0]?.role ?? organization?.orgMembers[0]?.role ?? 'viewer') as UserRole,
		}));
	}

	/** Renames unless another clinic of the organization already has the name (`renameClinic`). */
	renameClinic(clinicId: string, orgId: string | null, name: string): Promise<boolean> {
		return this.prisma.$transaction(async (tx) => {
			const conflict = await tx.clinic.findFirst({
				where: { orgId, name: { equals: name, mode: 'insensitive' }, id: { not: clinicId } },
				select: { id: true },
			});
			if (conflict) {
				return false;
			}
			await tx.clinic.update({ where: { id: clinicId }, data: { name } });
			return true;
		});
	}

	async isClinicNameTaken(orgId: string | null, name: string): Promise<boolean> {
		const clinic = await this.prisma.clinic.findFirst({
			where: { orgId, name: { equals: name, mode: 'insensitive' } },
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

	/** Clinic membership role, falling back to the user's organization role. */
	async getUserRoleInClinic(clinicId: string, userId: string): Promise<UserRole | null> {
		const member = await this.getClinicMember(clinicId, userId);
		if (member) {
			return member.role as UserRole;
		}

		const clinic = await this.getClinicById(clinicId);
		if (!clinic?.orgId) {
			return null;
		}

		const orgMember = await this.prisma.orgMember.findUnique({
			where: { orgId_userId: { orgId: clinic.orgId, userId } },
			select: { role: true },
		});
		return orgMember ? (orgMember.role as UserRole) : null;
	}

	/** Upstream `listClinicMembersWithRoles`: the clinic's own members, with their role. */
	listClinicMembersWithRoles(
		clinicId: string,
	): Promise<{ id: string; name: string; email: string; role: UserRole }[]> {
		return this.prisma.$queryRaw`
			SELECT u.id, u.name, u.email, pm.role
			FROM "user" u
			JOIN project_member pm ON pm.user_id = u.id
			WHERE pm.project_id = ${clinicId}`;
	}

	/** Users who are clinic members or members of the clinic's organization (upstream `listUsersWithClinicAccess`). */
	listUsersWithClinicAccess(
		clinicId: string,
	): Promise<{ id: string; name: string; email: string; role: UserRole }[]> {
		return this.prisma.$queryRaw`
			SELECT u.id, u.name, u.email, coalesce(pm.role, om.role) AS role
			FROM "user" u
			LEFT JOIN project_member pm ON pm.user_id = u.id AND pm.project_id = ${clinicId}
			LEFT JOIN org_member om ON om.user_id = u.id
				AND om.org_id = (SELECT org_id FROM project WHERE id = ${clinicId})
			WHERE pm.user_id IS NOT NULL OR om.user_id IS NOT NULL`;
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

	/** The clinic's custom GeoJSON boundary sets (`clinic.map_settings.customBoundaries`). */
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

	/** Read-modify-write of `map_settings` under a row lock, so concurrent edits don't drop each other's sets. */
	private mutateCustomBoundaries(
		clinicId: string,
		transform: (current: CustomBoundarySet[]) => CustomBoundarySet[],
	): Promise<CustomBoundarySet[]> {
		return this.prisma.$transaction(async (tx) => {
			const [row] = await tx.$queryRaw<{ mapSettings: MapSettings | null }[]>`
				SELECT map_settings AS "mapSettings" FROM project WHERE id = ${clinicId} FOR UPDATE`;
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
