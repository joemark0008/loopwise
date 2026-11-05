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
	type UserClinicPreferences,
} from './usage.types.js';

type PeriodSettings = {
	preferences: UserClinicPreferences;
	savedPeriods: SavedUsagePeriod[];
};

type PeriodSettingsTransform = (settings: PeriodSettings) => UserClinicPreferences;

const legacySavedPeriodSelectionSchema = z.object({
	mode: z.literal('saved'),
	entryId: z.string().min(1),
});

/**
 * Port of upstream `services/usage-period-settings.service.ts`: the usage period each user picks per clinic, and
 * the periods they save, stored in their preferences and repaired when malformed.
 */
@Injectable()
export class UsagePeriodSettingsService {
	constructor(private readonly users: UserRepository) {}

	async getAndRepairPeriodSettings(userId: string, clinicId: string): Promise<PeriodSettings> {
		const userPreferences = await this.users.getUserPreferences(userId);
		const current = getClinicPreferences(userPreferences, clinicId);
		const sanitized = sanitizePeriodSettings(current);
		if (!sanitized.changed) {
			return sanitized;
		}

		const repairedUserPreferences = await this.users.mutateUserPreferences(userId, (latest) => {
			const preferences = getClinicPreferences(latest, clinicId);
			const repaired = sanitizePeriodSettings(preferences).preferences;
			return setClinicPreferences(latest, clinicId, repaired);
		});
		const preferences = getClinicPreferences(repairedUserPreferences, clinicId);
		return {
			preferences,
			savedPeriods: sanitizeSavedPeriods(preferences),
		};
	}

	async mutatePeriodSettings(
		userId: string,
		clinicId: string,
		transform: PeriodSettingsTransform,
	): Promise<UserClinicPreferences> {
		const userPreferences = await this.users.mutateUserPreferences(userId, (current) => {
			const clinicPreferences = getClinicPreferences(current, clinicId);
			const { preferences, savedPeriods } = sanitizePeriodSettings(clinicPreferences);
			const updated = transform({ preferences, savedPeriods });
			return setClinicPreferences(current, clinicId, updated);
		});
		return getClinicPreferences(userPreferences, clinicId);
	}
}

export function assertSavedPeriodExists(savedPeriods: SavedUsagePeriod[], id: string): void {
	if (!savedPeriods.some((savedPeriod) => savedPeriod.id === id)) {
		throw new HandlerError('NOT_FOUND', 'Saved usage period not found.');
	}
}

function getClinicPreferences(preferences: StoredUserPreferences, clinicId: string): UserClinicPreferences {
	const clinicPreferences = preferences.projectPreferences?.[clinicId];
	return clinicPreferences && typeof clinicPreferences === 'object'
		? (clinicPreferences as UserClinicPreferences)
		: {};
}

function setClinicPreferences(
	preferences: StoredUserPreferences,
	clinicId: string,
	clinicPreferences: UserClinicPreferences,
): StoredUserPreferences {
	return {
		...preferences,
		projectPreferences: {
			...preferences.projectPreferences,
			[clinicId]: clinicPreferences,
		},
	};
}

function sanitizePeriodSettings(preferences: UserClinicPreferences): PeriodSettings & { changed: boolean } {
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

function sanitizeSavedPeriods(preferences: UserClinicPreferences): SavedUsagePeriod[] {
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
	selection: NonNullable<UserClinicPreferences['usagePeriod']>,
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
