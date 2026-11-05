import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LlmService } from '../agent/llm/llm.service.js';
import type { StoredUserPreferences, UserRepository } from '../users/user.repository.js';
import type { UsageRepository } from './usage.repository.js';
import { UsageService } from './usage.service.js';
import {
	DEFAULT_USAGE_PERIOD_SELECTION,
	MAX_SAVED_USAGE_PERIODS,
	SAVED_USAGE_PERIOD_LIMIT_MESSAGE,
} from './usage.types.js';
import { UsagePeriodSettingsService } from './usage-period-settings.service.js';

/**
 * Port of upstream `saved-usage-periods.routes.test.ts` on `UsageService`. Dropped: the stale-clinic check, as
 * `@ClinicAccess()` resolves the clinic from the same `clinicId` argument.
 */
const state = vi.hoisted(() => ({
	preferences: {} as Record<string, unknown>,
	role: 'admin' as 'admin' | 'user',
}));

const usageMocks = {
	getMessagesUsage: vi.fn(),
	getMessagesUsageByUser: vi.fn(),
	getTotalUsage: vi.fn(),
	getUsedProviders: vi.fn(),
};

const users = {
	getUserPreferences: vi.fn(async () => ({ clinicPreferences: { 'clinic-id': state.preferences } })),
	mutateUserPreferences: vi.fn(
		async (_userId: string, transform: (current: StoredUserPreferences) => StoredUserPreferences) => {
			const updated = transform({ clinicPreferences: { 'clinic-id': state.preferences } });
			state.preferences = (updated.clinicPreferences?.['clinic-id'] as Record<string, unknown> | undefined) ?? {};
			return updated;
		},
	),
};

const llm = { getClinicDeclaredModels: vi.fn(async () => []) };

const service = new UsageService(
	usageMocks as unknown as UsageRepository,
	new UsagePeriodSettingsService(users as unknown as UserRepository),
	llm as unknown as LlmService,
);

describe('saved usage period routes', () => {
	beforeEach(() => {
		state.preferences = {};
		state.role = 'admin';
		vi.clearAllMocks();
	});

	it('scopes regular users while leaving clinic admins organization-wide', async () => {
		const input = { period: { value: 15, unit: 'day' as const } };
		state.role = 'user';
		await createCaller().getMessagesUsage(input);
		expect(usageMocks.getMessagesUsage).toHaveBeenLastCalledWith('clinic-id', input, expect.any(Array), 'user-id');

		state.role = 'admin';
		await createCaller().getMessagesUsage(input);
		expect(usageMocks.getMessagesUsage).toHaveBeenLastCalledWith('clinic-id', input, expect.any(Array), undefined);
	});

	it('creates, updates, selects, and deletes saved periods', async () => {
		const caller = createCaller();
		const created = await caller.createSavedPeriod({
			clinicId: 'clinic-id',
			savedPeriod: { days: 5000, granularity: 'month' },
		});

		expect(created.id).toEqual(expect.any(String));
		await expect(caller.getPeriodSettings({ clinicId: 'clinic-id' })).resolves.toEqual({
			selection: { mode: 'saved', savedPeriodId: created.id },
			savedPeriods: [created],
		});

		const updated = await caller.updateSavedPeriod({
			clinicId: 'clinic-id',
			savedPeriod: { ...created, days: 730, granularity: 'day' },
		});
		await expect(caller.getPeriodSettings({ clinicId: 'clinic-id' })).resolves.toEqual({
			selection: { mode: 'saved', savedPeriodId: created.id },
			savedPeriods: [updated],
		});

		await caller.updatePeriodSelection({
			clinicId: 'clinic-id',
			selection: { mode: 'saved', savedPeriodId: created.id },
		});
		await expect(caller.getPeriodSettings({ clinicId: 'clinic-id' })).resolves.toEqual({
			selection: { mode: 'saved', savedPeriodId: created.id },
			savedPeriods: [updated],
		});

		await expect(caller.deleteSavedPeriod({ clinicId: 'clinic-id', id: created.id })).resolves.toEqual({
			id: created.id,
			selection: DEFAULT_USAGE_PERIOD_SELECTION,
		});
		await expect(caller.getPeriodSettings({ clinicId: 'clinic-id' })).resolves.toEqual({
			selection: DEFAULT_USAGE_PERIOD_SELECTION,
			savedPeriods: [],
		});
	});

	it('rejects creating more than the saved period limit', async () => {
		const savedPeriods = Array.from({ length: MAX_SAVED_USAGE_PERIODS }, (_, index) => ({
			id: `saved-period-${index}`,
			days: index + 1,
			granularity: 'day',
		}));
		state.preferences = { savedUsagePeriods: savedPeriods };

		await expect(
			createCaller().createSavedPeriod({
				clinicId: 'clinic-id',
				savedPeriod: { days: 30, granularity: 'day' },
			}),
		).rejects.toMatchObject({
			codeMessage: 'BAD_REQUEST',
			message: SAVED_USAGE_PERIOD_LIMIT_MESSAGE,
		});
		expect(state.preferences).toEqual({ savedUsagePeriods: savedPeriods });
	});

	it('repairs stored periods above the saved period limit', async () => {
		const savedPeriods = Array.from({ length: MAX_SAVED_USAGE_PERIODS + 1 }, (_, index) => ({
			id: `saved-period-${index}`,
			days: index + 1,
			granularity: 'day' as const,
		}));
		const retainedSavedPeriods = savedPeriods.slice(0, MAX_SAVED_USAGE_PERIODS);
		state.preferences = {
			usagePeriod: { mode: 'saved', savedPeriodId: savedPeriods.at(-1)?.id ?? '' },
			savedUsagePeriods: savedPeriods,
		};

		await expect(createCaller().getPeriodSettings({ clinicId: 'clinic-id' })).resolves.toEqual({
			selection: DEFAULT_USAGE_PERIOD_SELECTION,
			savedPeriods: retainedSavedPeriods,
		});
		expect(state.preferences).toEqual({
			usagePeriod: DEFAULT_USAGE_PERIOD_SELECTION,
			savedUsagePeriods: retainedSavedPeriods,
		});
	});

	it('rejects unknown saved periods', async () => {
		const caller = createCaller();

		await expect(
			caller.updatePeriodSelection({
				clinicId: 'clinic-id',
				selection: { mode: 'saved', savedPeriodId: 'missing' },
			}),
		).rejects.toMatchObject({ codeMessage: 'NOT_FOUND' });
		await expect(caller.deleteSavedPeriod({ clinicId: 'clinic-id', id: 'missing' })).rejects.toMatchObject({
			codeMessage: 'NOT_FOUND',
		});
	});

	it('preserves valid saved periods when stored data contains a malformed item', async () => {
		state.preferences = {
			savedUsagePeriods: [
				{ id: 'valid', days: 30, granularity: 'day' },
				{ id: 'invalid', days: 0, granularity: 'day' },
			],
		};
		const caller = createCaller();

		const created = await caller.createSavedPeriod({
			clinicId: 'clinic-id',
			savedPeriod: { days: 365, granularity: 'month' },
		});

		await expect(caller.getPeriodSettings({ clinicId: 'clinic-id' })).resolves.toEqual({
			selection: { mode: 'saved', savedPeriodId: created.id },
			savedPeriods: [{ id: 'valid', days: 30, granularity: 'day' }, created],
		});
	});

	it('repairs an orphaned saved selection', async () => {
		state.preferences = {
			usagePeriod: { mode: 'saved', savedPeriodId: 'invalid' },
			savedUsagePeriods: [{ id: 'invalid', days: 0, granularity: 'day' }],
		};

		await expect(createCaller().getPeriodSettings({ clinicId: 'clinic-id' })).resolves.toEqual({
			selection: DEFAULT_USAGE_PERIOD_SELECTION,
			savedPeriods: [],
		});
		expect(state.preferences).toEqual({
			usagePeriod: DEFAULT_USAGE_PERIOD_SELECTION,
			savedUsagePeriods: [],
		});
	});

	it('migrates a legacy saved selection', async () => {
		const savedPeriod = { id: 'year', days: 365, granularity: 'month' };
		state.preferences = {
			usagePeriod: { mode: 'saved', entryId: savedPeriod.id },
			savedUsagePeriods: [savedPeriod],
		};

		await expect(createCaller().getPeriodSettings({ clinicId: 'clinic-id' })).resolves.toEqual({
			selection: { mode: 'saved', savedPeriodId: savedPeriod.id },
			savedPeriods: [savedPeriod],
		});
		expect(state.preferences).toEqual({
			usagePeriod: { mode: 'saved', savedPeriodId: savedPeriod.id },
			savedUsagePeriods: [savedPeriod],
		});
	});

	it('removes legacy custom selections and malformed saved periods from storage', async () => {
		const validSavedPeriod = { id: 'valid', days: 365, granularity: 'month' };
		state.preferences = {
			usagePeriod: { mode: 'custom', customPeriod: { value: 30, unit: 'day' } },
			savedUsagePeriods: [validSavedPeriod, { id: 'invalid', days: 0, granularity: 'day' }],
		};

		await expect(createCaller().getPeriodSettings({ clinicId: 'clinic-id' })).resolves.toEqual({
			selection: DEFAULT_USAGE_PERIOD_SELECTION,
			savedPeriods: [validSavedPeriod],
		});
		expect(state.preferences).toEqual({
			usagePeriod: DEFAULT_USAGE_PERIOD_SELECTION,
			savedUsagePeriods: [validSavedPeriod],
		});
	});
});

/** Upstream's tRPC caller, on the service as the resolvers call it. */
function createCaller() {
	const viewer = () => ({ userId: 'user-id', role: state.role });
	return {
		getMessagesUsage: (input: Parameters<UsageService['getMessagesUsage']>[2]) =>
			service.getMessagesUsage('clinic-id', viewer(), input),
		getPeriodSettings: ({ clinicId }: { clinicId: string }) => service.getPeriodSettings('user-id', clinicId),
		updatePeriodSelection: ({
			clinicId,
			selection,
		}: {
			clinicId: string;
			selection: Parameters<UsageService['updatePeriodSelection']>[2];
		}) => service.updatePeriodSelection('user-id', clinicId, selection),
		createSavedPeriod: ({
			clinicId,
			savedPeriod,
		}: {
			clinicId: string;
			savedPeriod: Parameters<UsageService['createSavedPeriod']>[2];
		}) => service.createSavedPeriod('user-id', clinicId, savedPeriod),
		updateSavedPeriod: ({
			clinicId,
			savedPeriod,
		}: {
			clinicId: string;
			savedPeriod: Parameters<UsageService['updateSavedPeriod']>[2];
		}) => service.updateSavedPeriod('user-id', clinicId, savedPeriod),
		deleteSavedPeriod: ({ clinicId, id }: { clinicId: string; id: string }) =>
			service.deleteSavedPeriod('user-id', clinicId, id),
	};
}
