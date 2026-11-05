import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DATE_FORMAT_PRESETS, type DisplaySettings } from '@loopwise/shared/date';
import { Injectable } from '@nestjs/common';
import { z } from 'zod/v4';

import { isDatabaseObjectAllowed } from '../../../agent/services/context-access.js';
import { fullClinicContextAccess } from '../../../agent/services/user-group-context-access.service.js';
import { type DatabaseObject, getDatabaseObjects } from '../../../agent/user-rules.js';
import { HandlerError } from '../../../common/errors/handler-error.js';
import { AccessService, type ClinicAccessGrant } from '../../../common/guards/access.service.js';
import { ConfigService } from '../../../config/config.service.js';
import type { Clinic, ClinicSavedPrompt, StaffRole } from '../../../generated/prisma/client.js';
import { ClinicRepository } from './clinic.repository.js';
import { ClinicSavedPromptRepository } from './clinic-saved-prompt.repository.js';
import type { ClinicSummary } from './models/clinic.model.js';

const displaySettingsInputSchema = z.object({
	dateFormat: z
		.object({
			preset: z.enum(DATE_FORMAT_PRESETS),
			customFormat: z.string().trim().max(64).optional(),
		})
		.optional(),
});

/** Port of upstream trpc `clinic` (core procedures) and `services/clinic*.ts`. */
@Injectable()
export class ClinicsService {
	constructor(
		private readonly clinics: ClinicRepository,
		private readonly savedPrompts: ClinicSavedPromptRepository,
		private readonly access: AccessService,
		private readonly config: ConfigService,
	) {}

	/** Every clinic the user can open (a role there, or a membership of its organization), with their roles. */
	async listForUser(userId: string): Promise<ClinicSummary[]> {
		return (await this.access.listUserClinics(userId)).map(toSummary);
	}

	/** The clinic the request works on (the selected one when the user can open it), or null when they have none. */
	async getCurrent(userId: string, selectedClinicId: string | null): Promise<ClinicSummary | null> {
		const grant = await this.access.findClinicAccess(userId, selectedClinicId);
		return grant ? toSummary(grant) : null;
	}

	/**
	 * loopwise addition (upstream self-hosted has one clinic from a default clinic path): a clinic gets a folder under
	 * `LOOPWISE_CLINICS_DIR` for its context and a code unique in the organization; it belongs to the organization the
	 * request works on (viewers there can't create one), and the user becomes its ADMIN.
	 */
	async createClinic(userId: string, selectedClinicId: string | null, name: string): Promise<ClinicSummary> {
		const trimmed = name.trim();
		const { organization, role } = await this.access.resolveOrganizationMembership(userId, selectedClinicId, null);
		if (role === 'VIEWER') {
			throw new HandlerError('FORBIDDEN', 'Viewers cannot create clinics.');
		}
		if (await this.clinics.isClinicNameTaken(organization.id, trimmed)) {
			throw new HandlerError('CONFLICT', `A clinic named "${trimmed}" already exists.`);
		}

		const id = randomUUID();
		const folder = path.join(this.clinicsDir(), `${slugify(trimmed)}-${id.slice(0, 8)}`);
		await mkdir(folder, { recursive: true });
		await writeFile(
			path.join(folder, 'loopwise_config.yaml'),
			`clinic_name: ${JSON.stringify(trimmed)}\ndatabases: []\n`,
		);
		try {
			const staffRoles: StaffRole[] = ['ADMIN'];
			const clinic = await this.clinics.createClinic({
				id,
				name: trimmed,
				kind: 'local',
				path: folder,
				organizationId: organization.id,
			});
			await this.clinics.grantClinicRoles(clinic.id, userId, staffRoles);
			return toSummary({ clinic, userRole: 'admin', staffRoles });
		} catch (error) {
			await rm(folder, { recursive: true, force: true });
			throw error;
		}
	}

	/** Renames the selected clinic; the name stays unique in the organization. */
	async renameClinic(grant: ClinicAccessGrant, clinicId: string, name: string): Promise<ClinicSummary> {
		const { clinic } = grant;
		if (clinicId !== clinic.id) {
			throw new HandlerError('CONFLICT', 'The selected clinic changed. Reload the page and try again.');
		}
		const trimmed = name.trim();
		if (!(await this.clinics.renameClinic(clinic.id, clinic.organizationId, trimmed))) {
			throw new HandlerError('CONFLICT', `A clinic named "${trimmed}" already exists.`);
		}
		return toSummary({ ...grant, clinic: { ...clinic, name: trimmed } });
	}

	/** Deletes the clinic; its folder too when loopwise created it under `LOOPWISE_CLINICS_DIR`. */
	async deleteClinic(clinic: Clinic): Promise<void> {
		await this.clinics.deleteClinic(clinic.id);
		if (clinic.path && isInside(this.clinicsDir(), clinic.path)) {
			await rm(clinic.path, { recursive: true, force: true });
		}
	}

	listSavedPrompts(clinicId: string): Promise<ClinicSavedPrompt[]> {
		return this.savedPrompts.listSavedPrompts(clinicId);
	}

	/** Upstream `getClinicSavedPrompts`: another clinic's prompts, empty when the user isn't in it. */
	async listClinicSavedPromptsForUser(clinicId: string, userId: string): Promise<ClinicSavedPrompt[]> {
		if (!(await this.access.getUserRoleInClinic(clinicId, userId))) {
			return [];
		}
		return this.savedPrompts.listSavedPrompts(clinicId);
	}

	createSavedPrompt(clinicId: string, title: string, prompt: string): Promise<ClinicSavedPrompt> {
		return this.savedPrompts.createSavedPrompt({ clinicId, title, prompt });
	}

	async updateSavedPrompt(
		clinicId: string,
		promptId: string,
		data: { title?: string; prompt?: string },
	): Promise<ClinicSavedPrompt> {
		const updated = await this.savedPrompts.updateSavedPrompt(clinicId, promptId, data);
		if (!updated) {
			throw new HandlerError('NOT_FOUND', 'Saved prompt not found');
		}
		return updated;
	}

	deleteSavedPrompt(clinicId: string, promptId: string): Promise<void> {
		return this.savedPrompts.deleteSavedPrompt(clinicId, promptId);
	}

	private clinicsDir(): string {
		return path.resolve(this.config.env.LOOPWISE_CLINICS_DIR);
	}

	/**
	 * Upstream `clinic.getDatabaseObjects`: the synced tables, for `@` mentions in the chat input. Filtered by the
	 * user's warehouse table access, which is full access until user groups are ported (Phase 6).
	 */
	listDatabaseObjects(clinic: Clinic): DatabaseObject[] {
		if (!clinic.path) {
			return [];
		}
		const access = fullClinicContextAccess().warehouseTableAccess;
		return getDatabaseObjects(clinic.path).filter((object) => isDatabaseObjectAllowed(access, object));
	}

	getDisplaySettings(clinicId: string): Promise<DisplaySettings> {
		return this.clinics.getDisplaySettings(clinicId);
	}

	updateDisplaySettings(clinicId: string, input: unknown): Promise<DisplaySettings> {
		const result = displaySettingsInputSchema.safeParse(input);
		if (!result.success) {
			throw new HandlerError('BAD_REQUEST', result.error.issues.map((issue) => issue.message).join('; '));
		}
		return this.clinics.updateDisplaySettings(clinicId, result.data);
	}
}

function toSummary({ clinic, userRole, staffRoles }: ClinicAccessGrant): ClinicSummary {
	return {
		id: clinic.id,
		name: clinic.name,
		code: clinic.code,
		kind: clinic.kind,
		path: clinic.path,
		organizationId: clinic.organizationId,
		userRole,
		staffRoles,
		createdAt: clinic.createdAt,
		updatedAt: clinic.updatedAt,
	};
}

function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'clinic'
	);
}

function isInside(parent: string, child: string): boolean {
	const relative = path.relative(parent, path.resolve(child));
	return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
