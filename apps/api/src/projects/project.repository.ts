import { Injectable } from '@nestjs/common';
import type { CustomBoundarySet, MapSettings } from '@quarry/shared';
import type { DisplaySettings } from '@quarry/shared/date';
import { DEFAULT_DATE_FORMAT_SETTINGS } from '@quarry/shared/date';
import type { UserRole } from '@quarry/shared/types';

import { HandlerError } from '../common/errors/handler-error.js';
import { ConfigService } from '../config/config.service.js';
import type { Prisma, Project, ProjectMember } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DbExecutor } from '../prisma/prisma.types.js';
import { defaultUserGroupValues } from './default-user-group.js';

/** Port of upstream `queries/project.queries.ts` (the part Phase 1 needs: lookup, membership, roles). */
@Injectable()
export class ProjectRepository {
	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
	) {}

	getProjectById(projectId: string): Promise<Project | null> {
		return this.prisma.project.findUnique({ where: { id: projectId } });
	}

	getProjectByPath(path: string, executor: DbExecutor = this.prisma): Promise<Project | null> {
		return executor.project.findFirst({ where: { path } });
	}

	/** Creates a project together with its default "All Users" group. */
	async createProject(
		project: Prisma.ProjectUncheckedCreateInput,
		executor?: Prisma.TransactionClient,
	): Promise<Project> {
		const create = async (tx: Prisma.TransactionClient) => {
			const created = await tx.project.create({ data: project });
			await tx.userGroup.create({ data: defaultUserGroupValues(created.id) });
			return created;
		};
		return executor ? create(executor) : this.prisma.$transaction(create);
	}

	getProjectMember(
		projectId: string,
		userId: string,
		executor: DbExecutor = this.prisma,
	): Promise<ProjectMember | null> {
		return executor.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
	}

	addProjectMember(
		member: Prisma.ProjectMemberUncheckedCreateInput,
		executor: DbExecutor = this.prisma,
	): Promise<ProjectMember> {
		return executor.projectMember.create({ data: member });
	}

	async getDefaultProject(): Promise<Project | null> {
		const projectPath = this.config.env.QUARRY_DEFAULT_PROJECT_PATH;
		if (projectPath) {
			return this.getProjectByPath(projectPath);
		}
		return this.prisma.project.findFirst();
	}

	/**
	 * The project a request works on. quarry is self-hosted but has several projects (upstream's cloud mode):
	 * the selected project when the user can access it, else the default project (`QUARRY_DEFAULT_PROJECT_PATH`)
	 * when the user has a role in it, else the user's first project.
	 */
	async getProjectByUserId(userId: string, selectedProjectId?: string | null): Promise<Project | null> {
		const projects = await this.listUserProjectsWithRoles(userId);
		if (selectedProjectId) {
			const selected = projects.find(({ project }) => project.id === selectedProjectId);
			if (selected) {
				return selected.project;
			}
		}
		const defaultProject = await this.getDefaultProject();
		if (defaultProject && projects.some(({ project }) => project.id === defaultProject.id)) {
			return defaultProject;
		}
		return projects[0]?.project ?? null;
	}

	/** Projects the user reaches through a project membership or their organization (`listUserProjectsWithRoles`). */
	async listUserProjectsWithRoles(userId: string): Promise<{ project: Project; userRole: UserRole }[]> {
		const projects = await this.prisma.project.findMany({
			where: {
				OR: [{ projectMembers: { some: { userId } } }, { organization: { orgMembers: { some: { userId } } } }],
			},
			include: {
				projectMembers: { where: { userId }, select: { role: true } },
				organization: { select: { orgMembers: { where: { userId }, select: { role: true } } } },
			},
			orderBy: { name: 'asc' },
		});
		return projects.map(({ projectMembers, organization, ...project }) => ({
			project,
			userRole: (projectMembers[0]?.role ?? organization?.orgMembers[0]?.role ?? 'viewer') as UserRole,
		}));
	}

	/** Renames unless another project of the organization already has the name (`renameProject`). */
	renameProject(projectId: string, orgId: string | null, name: string): Promise<boolean> {
		return this.prisma.$transaction(async (tx) => {
			const conflict = await tx.project.findFirst({
				where: { orgId, name: { equals: name, mode: 'insensitive' }, id: { not: projectId } },
				select: { id: true },
			});
			if (conflict) {
				return false;
			}
			await tx.project.update({ where: { id: projectId }, data: { name } });
			return true;
		});
	}

	async isProjectNameTaken(orgId: string | null, name: string): Promise<boolean> {
		const project = await this.prisma.project.findFirst({
			where: { orgId, name: { equals: name, mode: 'insensitive' } },
			select: { id: true },
		});
		return project !== null;
	}

	updateProject(projectId: string, data: Prisma.ProjectUncheckedUpdateInput): Promise<Project> {
		return this.prisma.project.update({ where: { id: projectId }, data });
	}

	async deleteProject(projectId: string): Promise<void> {
		await this.prisma.project.delete({ where: { id: projectId } });
	}

	/** Project membership role, falling back to the user's organization role. */
	async getUserRoleInProject(projectId: string, userId: string): Promise<UserRole | null> {
		const member = await this.getProjectMember(projectId, userId);
		if (member) {
			return member.role as UserRole;
		}

		const project = await this.getProjectById(projectId);
		if (!project?.orgId) {
			return null;
		}

		const orgMember = await this.prisma.orgMember.findUnique({
			where: { orgId_userId: { orgId: project.orgId, userId } },
			select: { role: true },
		});
		return orgMember ? (orgMember.role as UserRole) : null;
	}

	/** Upstream `listProjectMembersWithRoles`: the project's own members, with their role. */
	listProjectMembersWithRoles(
		projectId: string,
	): Promise<{ id: string; name: string; email: string; role: UserRole }[]> {
		return this.prisma.$queryRaw`
			SELECT u.id, u.name, u.email, pm.role
			FROM "user" u
			JOIN project_member pm ON pm.user_id = u.id
			WHERE pm.project_id = ${projectId}`;
	}

	/** Users who are project members or members of the project's organization (upstream `listUsersWithProjectAccess`). */
	listUsersWithProjectAccess(
		projectId: string,
	): Promise<{ id: string; name: string; email: string; role: UserRole }[]> {
		return this.prisma.$queryRaw`
			SELECT u.id, u.name, u.email, coalesce(pm.role, om.role) AS role
			FROM "user" u
			LEFT JOIN project_member pm ON pm.user_id = u.id AND pm.project_id = ${projectId}
			LEFT JOIN org_member om ON om.user_id = u.id
				AND om.org_id = (SELECT org_id FROM project WHERE id = ${projectId})
			WHERE pm.user_id IS NOT NULL OR om.user_id IS NOT NULL`;
	}

	/** Upstream `getDisplaySettings`: the project's date format, defaulted. */
	async getDisplaySettings(projectId: string): Promise<DisplaySettings> {
		const project = await this.getProjectById(projectId);
		const stored = (project?.displaySettings ?? {}) as DisplaySettings;
		return { dateFormat: stored.dateFormat ?? { ...DEFAULT_DATE_FORMAT_SETTINGS } };
	}

	/** Upstream `updateDisplaySettings`: merges into the stored settings, keeping the date format when not given. */
	async updateDisplaySettings(projectId: string, settings: DisplaySettings): Promise<DisplaySettings> {
		const current = await this.getDisplaySettings(projectId);
		const next: DisplaySettings = {
			...current,
			...settings,
			dateFormat: settings.dateFormat ?? current.dateFormat,
		};
		await this.prisma.project.update({
			where: { id: projectId },
			data: { displaySettings: next as unknown as Prisma.InputJsonValue },
		});
		return next;
	}

	async getMapSettings(projectId: string): Promise<MapSettings> {
		const project = await this.getProjectById(projectId);
		return (project?.mapSettings ?? {}) as MapSettings;
	}

	/** The project's custom GeoJSON boundary sets (`project.map_settings.customBoundaries`). */
	async getCustomBoundaries(projectId: string): Promise<CustomBoundarySet[]> {
		const settings = await this.getMapSettings(projectId);
		return settings.customBoundaries ?? [];
	}

	addCustomBoundary(projectId: string, boundary: CustomBoundarySet): Promise<CustomBoundarySet[]> {
		return this.mutateCustomBoundaries(projectId, (current) => {
			if (current.some((b) => b.key === boundary.key)) {
				throw new HandlerError('BAD_REQUEST', `A boundary set with key "${boundary.key}" already exists.`);
			}
			return [...current, boundary];
		});
	}

	updateCustomBoundary(
		projectId: string,
		key: string,
		patch: Partial<CustomBoundarySet>,
	): Promise<CustomBoundarySet[]> {
		return this.mutateCustomBoundaries(projectId, (current) => {
			if (patch.key && patch.key !== key && current.some((b) => b.key === patch.key)) {
				throw new HandlerError('BAD_REQUEST', `A boundary set with key "${patch.key}" already exists.`);
			}
			return current.map((b) => (b.key === key ? { ...b, ...patch } : b));
		});
	}

	deleteCustomBoundary(projectId: string, key: string): Promise<CustomBoundarySet[]> {
		return this.mutateCustomBoundaries(projectId, (current) => current.filter((b) => b.key !== key));
	}

	/** Read-modify-write of `map_settings` under a row lock, so concurrent edits don't drop each other's sets. */
	private mutateCustomBoundaries(
		projectId: string,
		transform: (current: CustomBoundarySet[]) => CustomBoundarySet[],
	): Promise<CustomBoundarySet[]> {
		return this.prisma.$transaction(async (tx) => {
			const [row] = await tx.$queryRaw<{ mapSettings: MapSettings | null }[]>`
				SELECT map_settings AS "mapSettings" FROM project WHERE id = ${projectId} FOR UPDATE`;
			const settings = row?.mapSettings ?? {};
			const next = transform(settings.customBoundaries ?? []);
			await tx.project.update({
				where: { id: projectId },
				data: { mapSettings: { ...settings, customBoundaries: next } as unknown as Prisma.InputJsonValue },
			});
			return next;
		});
	}
}
