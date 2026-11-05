import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DATE_FORMAT_PRESETS, type DisplaySettings } from '@loopwise/shared/date';
import type { UserRole } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';
import { z } from 'zod/v4';

import { isDatabaseObjectAllowed } from '../agent/services/context-access.js';
import { fullClinicContextAccess } from '../agent/services/user-group-context-access.service.js';
import { type DatabaseObject, getDatabaseObjects } from '../agent/user-rules.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { ConfigService } from '../config/config.service.js';
import type { Clinic, ClinicSavedPrompt } from '../generated/prisma/client.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
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
		private readonly organizations: OrganizationRepository,
		private readonly config: ConfigService,
	) {}

	async listForUser(userId: string): Promise<ClinicSummary[]> {
		const clinics = await this.clinics.listUserClinicsWithRoles(userId);
		return clinics.map(({ clinic, userRole }) => toSummary(clinic, userRole));
	}

	async getCurrent(userId: string, selectedClinicId: string | null): Promise<ClinicSummary | null> {
		const clinic = await this.clinics.getClinicByUserId(userId, selectedClinicId);
		if (!clinic) {
			return null;
		}
		const userRole = await this.clinics.getUserRoleInClinic(clinic.id, userId);
		return userRole ? toSummary(clinic, userRole) : null;
	}

	/**
	 * loopwise addition (upstream self-hosted has one clinic from a default clinic path): a clinic gets a
	 * folder under `LOOPWISE_CLINICS_DIR` for its context, in the user's organization, with the user as admin.
	 */
	async createClinic(userId: string, name: string): Promise<ClinicSummary> {
		const trimmed = name.trim();
		const membership = await this.organizations.getUserOrgMembership(userId);
		const orgId = membership?.orgId ?? null;
		if (await this.clinics.isClinicNameTaken(orgId, trimmed)) {
			throw new HandlerError('CONFLICT', `A clinic named "${trimmed}" already exists.`);
		}

		const id = randomUUID();
		const folder = path.join(this.clinicsDir(), `${slugify(trimmed)}-${id.slice(0, 8)}`);
		await mkdir(folder, { recursive: true });
		await writeFile(
			path.join(folder, 'loopwise_config.yaml'),
			`project_name: ${JSON.stringify(trimmed)}\ndatabases: []\n`,
		);
		try {
			const clinic = await this.clinics.createClinic({
				id,
				name: trimmed,
				type: 'local',
				path: folder,
				orgId,
			});
			await this.clinics.addClinicMember({ clinicId: clinic.id, userId, role: 'admin' });
			return toSummary(clinic, 'admin');
		} catch (error) {
			await rm(folder, { recursive: true, force: true });
			throw error;
		}
	}

	async renameClinic(clinic: Clinic, clinicId: string, name: string): Promise<ClinicSummary> {
		if (clinicId !== clinic.id) {
			throw new HandlerError('CONFLICT', 'The selected clinic changed. Reload the page and try again.');
		}
		const trimmed = name.trim();
		if (!(await this.clinics.renameClinic(clinic.id, clinic.orgId, trimmed))) {
			throw new HandlerError('CONFLICT', `A clinic named "${trimmed}" already exists.`);
		}
		return toSummary({ ...clinic, name: trimmed }, 'admin');
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
		if (!(await this.clinics.getUserRoleInClinic(clinicId, userId))) {
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

function toSummary(clinic: Clinic, userRole: UserRole): ClinicSummary {
	return {
		id: clinic.id,
		name: clinic.name,
		type: clinic.type,
		path: clinic.path,
		orgId: clinic.orgId,
		userRole,
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
