import { randomUUID } from 'node:crypto';

import type { LlmProvider, UserRole } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';
import type { z } from 'zod/v4';

import { LlmService } from '../agent/llm/llm.service.js';
import { HandlerError } from '../common/errors/handler-error.js';
import type {
	SavedUsagePeriodInput,
	UpdateSavedUsagePeriodInput,
	UsageFilterInput,
	UsagePeriodSelectionInput,
} from './dto/usage.input.js';
import { UsageRepository } from './usage.repository.js';
import {
	DEFAULT_USAGE_PERIOD_SELECTION,
	MAX_SAVED_USAGE_PERIODS,
	SAVED_USAGE_PERIOD_LIMIT_MESSAGE,
	type SavedUsagePeriod,
	savedUsagePeriodInputSchema,
	savedUsagePeriodSchema,
	type TotalUsageRecord,
	type UsageByUserRecord,
	usageChartFilterSchema,
	usageFilterSchema,
	type UsagePeriodSelection,
	usagePeriodSelectionSchema,
	type UsageRecord,
} from './usage.types.js';
import { buildModelCostRows } from './usage-costs.js';
import { assertSavedPeriodExists, UsagePeriodSettingsService } from './usage-period-settings.service.js';

/** Who asks: project admins see everyone's usage, other members their own. */
export interface UsageViewer {
	userId: string;
	role: UserRole;
}

/** Port of upstream `trpc/usage.routes.ts` (Settings → Usage). */
@Injectable()
export class UsageService {
	constructor(
		private readonly usage: UsageRepository,
		private readonly periodSettings: UsagePeriodSettingsService,
		private readonly llm: LlmService,
	) {}

	async getMessagesUsage(projectId: string, viewer: UsageViewer, input: UsageFilterInput): Promise<UsageRecord[]> {
		const filter = parse(usageChartFilterSchema, input);
		return this.usage.getMessagesUsage(projectId, filter, await this.getCosts(projectId), scopeOf(viewer));
	}

	async getMessagesUsageByUser(
		projectId: string,
		viewer: UsageViewer,
		input: UsageFilterInput,
	): Promise<UsageByUserRecord[]> {
		const filter = parse(usageChartFilterSchema, input);
		return this.usage.getMessagesUsageByUser(projectId, filter, await this.getCosts(projectId), scopeOf(viewer));
	}

	getTotalUsage(projectId: string, viewer: UsageViewer, input: UsageFilterInput): Promise<TotalUsageRecord> {
		return this.usage.getTotalUsage(projectId, parse(usageFilterSchema, input), scopeOf(viewer));
	}

	getUserChatCounts(projectId: string): Promise<Array<{ userName: string; chatCount: number }>> {
		return this.usage.getUserChatCounts(projectId);
	}

	getUsedProviders(projectId: string, viewer: UsageViewer): Promise<LlmProvider[]> {
		return this.usage.getUsedProviders(projectId, scopeOf(viewer));
	}

	async getPeriodSettings(
		userId: string,
		projectId: string,
	): Promise<{ selection: UsagePeriodSelection | null; savedPeriods: SavedUsagePeriod[] }> {
		const { preferences, savedPeriods } = await this.periodSettings.getAndRepairPeriodSettings(userId, projectId);
		return { selection: preferences.usagePeriod ?? null, savedPeriods };
	}

	async updatePeriodSelection(
		userId: string,
		projectId: string,
		input: UsagePeriodSelectionInput,
	): Promise<UsagePeriodSelection | null> {
		const selection = parse(usagePeriodSelectionSchema, input);
		const preferences = await this.periodSettings.mutatePeriodSettings(
			userId,
			projectId,
			({ preferences: current, savedPeriods }) => {
				if (selection.mode === 'saved') {
					assertSavedPeriodExists(savedPeriods, selection.savedPeriodId);
				}
				return { ...current, usagePeriod: selection };
			},
		);
		return preferences.usagePeriod ?? null;
	}

	async createSavedPeriod(
		userId: string,
		projectId: string,
		input: SavedUsagePeriodInput,
	): Promise<SavedUsagePeriod> {
		const savedPeriod = { id: randomUUID(), ...parse(savedUsagePeriodInputSchema, input) };
		await this.periodSettings.mutatePeriodSettings(userId, projectId, ({ preferences: current, savedPeriods }) => {
			if (savedPeriods.length >= MAX_SAVED_USAGE_PERIODS) {
				throw new HandlerError('BAD_REQUEST', SAVED_USAGE_PERIOD_LIMIT_MESSAGE);
			}
			return {
				...current,
				usagePeriod: { mode: 'saved', savedPeriodId: savedPeriod.id },
				savedUsagePeriods: [...savedPeriods, savedPeriod],
			};
		});
		return savedPeriod;
	}

	async updateSavedPeriod(
		userId: string,
		projectId: string,
		input: UpdateSavedUsagePeriodInput,
	): Promise<SavedUsagePeriod> {
		const nextSavedPeriod = parse(savedUsagePeriodSchema, input);
		await this.periodSettings.mutatePeriodSettings(userId, projectId, ({ preferences: current, savedPeriods }) => {
			assertSavedPeriodExists(savedPeriods, nextSavedPeriod.id);
			return {
				...current,
				savedUsagePeriods: savedPeriods.map((savedPeriod) =>
					savedPeriod.id === nextSavedPeriod.id ? nextSavedPeriod : savedPeriod,
				),
			};
		});
		return nextSavedPeriod;
	}

	async deleteSavedPeriod(
		userId: string,
		projectId: string,
		id: string,
	): Promise<{ id: string; selection: UsagePeriodSelection | null }> {
		const preferences = await this.periodSettings.mutatePeriodSettings(
			userId,
			projectId,
			({ preferences: current, savedPeriods }) => {
				assertSavedPeriodExists(savedPeriods, id);
				const usagePeriod =
					current.usagePeriod?.mode === 'saved' && current.usagePeriod.savedPeriodId === id
						? DEFAULT_USAGE_PERIOD_SELECTION
						: current.usagePeriod;
				return {
					...current,
					usagePeriod,
					savedUsagePeriods: savedPeriods.filter((savedPeriod) => savedPeriod.id !== id),
				};
			},
		);
		return { id, selection: preferences.usagePeriod ?? null };
	}

	private async getCosts(projectId: string) {
		return buildModelCostRows(await this.llm.getProjectDeclaredModels(projectId));
	}
}

function scopeOf(viewer: UsageViewer): string | undefined {
	return viewer.role === 'admin' ? undefined : viewer.userId;
}

/** GraphQL sends absent optional fields as null; upstream's schemas expect them left out. */
function parse<T extends z.ZodType>(schema: T, input: object): z.infer<T> {
	const withoutNulls = JSON.parse(JSON.stringify(input, (_key, value: unknown) => value ?? undefined)) as unknown;
	const result = schema.safeParse(withoutNulls);
	if (!result.success) {
		throw new HandlerError('BAD_REQUEST', result.error.issues[0]?.message ?? 'Invalid usage request.');
	}
	return result.data;
}
