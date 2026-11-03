import { Injectable } from '@nestjs/common';
import { z } from 'zod/v4';

import { HandlerError } from '../common/errors/handler-error.js';
import { type StoredUserPreferences, UserRepository } from '../users/user.repository.js';
import {
	DEFAULT_USAGE_PERIOD_SELECTION,
	MAX_SAVED_USAGE_PERIODS,
	type SavedUsagePeriod,
	savedUsagePeriodSchema,
	usagePeriodSelectionSchema,
	type UserProjectPreferences,
} from './usage.types.js';

type PeriodSettings = {
	preferences: UserProjectPreferences;
	savedPeriods: SavedUsagePeriod[];
};

type PeriodSettingsTransform = (settings: PeriodSettings) => UserProjectPreferences;

const legacySavedPeriodSelectionSchema = z.object({
	mode: z.literal('saved'),
	entryId: z.string().min(1),
});

/**
 * Port of upstream `services/usage-period-settings.service.ts`: the usage period each user picks per project, and
 * the periods they save, stored in their preferences and repaired when malformed.
 */
@Injectable()
export class UsagePeriodSettingsService {
	constructor(private readonly users: UserRepository) {}

	async getAndRepairPeriodSettings(userId: string, projectId: string): Promise<PeriodSettings> {
		const userPreferences = await this.users.getUserPreferences(userId);
		const current = getProjectPreferences(userPreferences, projectId);
		const sanitized = sanitizePeriodSettings(current);
		if (!sanitized.changed) {
			return sanitized;
		}

		const repairedUserPreferences = await this.users.mutateUserPreferences(userId, (latest) => {
			const preferences = getProjectPreferences(latest, projectId);
			const repaired = sanitizePeriodSettings(preferences).preferences;
			return setProjectPreferences(latest, projectId, repaired);
		});
		const preferences = getProjectPreferences(repairedUserPreferences, projectId);
		return {
			preferences,
			savedPeriods: sanitizeSavedPeriods(preferences),
		};
	}

	async mutatePeriodSettings(
		userId: string,
		projectId: string,
		transform: PeriodSettingsTransform,
	): Promise<UserProjectPreferences> {
		const userPreferences = await this.users.mutateUserPreferences(userId, (current) => {
			const projectPreferences = getProjectPreferences(current, projectId);
			const { preferences, savedPeriods } = sanitizePeriodSettings(projectPreferences);
			const updated = transform({ preferences, savedPeriods });
			return setProjectPreferences(current, projectId, updated);
		});
		return getProjectPreferences(userPreferences, projectId);
	}
}

export function assertSavedPeriodExists(savedPeriods: SavedUsagePeriod[], id: string): void {
	if (!savedPeriods.some((savedPeriod) => savedPeriod.id === id)) {
		throw new HandlerError('NOT_FOUND', 'Saved usage period not found.');
	}
}

function getProjectPreferences(preferences: StoredUserPreferences, projectId: string): UserProjectPreferences {
	const projectPreferences = preferences.projectPreferences?.[projectId];
	return projectPreferences && typeof projectPreferences === 'object'
		? (projectPreferences as UserProjectPreferences)
		: {};
}

function setProjectPreferences(
	preferences: StoredUserPreferences,
	projectId: string,
	projectPreferences: UserProjectPreferences,
): StoredUserPreferences {
	return {
		...preferences,
		projectPreferences: {
			...preferences.projectPreferences,
			[projectId]: projectPreferences,
		},
	};
}

function sanitizePeriodSettings(preferences: UserProjectPreferences): PeriodSettings & { changed: boolean } {
	const savedPeriods = sanitizeSavedPeriods(preferences);
	const parsedSelection = parsePeriodSelection(preferences.usagePeriod);
	const usagePeriod =
		preferences.usagePeriod === undefined
			? undefined
			: parsedSelection.success && isValidPeriodSelection(parsedSelection.data, savedPeriods)
				? parsedSelection.data
				: DEFAULT_USAGE_PERIOD_SELECTION;
	const sanitized = {
		...preferences,
		usagePeriod,
		savedUsagePeriods: preferences.savedUsagePeriods === undefined ? undefined : savedPeriods,
	};
	return {
		preferences: sanitized,
		savedPeriods,
		changed: JSON.stringify(sanitized) !== JSON.stringify(preferences),
	};
}

function sanitizeSavedPeriods(preferences: UserProjectPreferences): SavedUsagePeriod[] {
	if (!Array.isArray(preferences.savedUsagePeriods)) {
		return [];
	}
	return preferences.savedUsagePeriods
		.flatMap((savedPeriod) => {
			const parsed = savedUsagePeriodSchema.safeParse(savedPeriod);
			return parsed.success ? [parsed.data] : [];
		})
		.slice(0, MAX_SAVED_USAGE_PERIODS);
}

function isValidPeriodSelection(
	selection: NonNullable<UserProjectPreferences['usagePeriod']>,
	savedPeriods: SavedUsagePeriod[],
): boolean {
	return selection.mode !== 'saved' || savedPeriods.some(({ id }) => id === selection.savedPeriodId);
}

function parsePeriodSelection(value: unknown) {
	const parsed = usagePeriodSelectionSchema.safeParse(value);
	if (parsed.success) {
		return parsed;
	}
	const legacy = legacySavedPeriodSelectionSchema.safeParse(value);
	return legacy.success
		? usagePeriodSelectionSchema.safeParse({
				mode: 'saved',
				savedPeriodId: legacy.data.entryId,
			})
		: parsed;
}
