import type { ChartPluginManifestEntry } from '@loopwise/shared';
import { isBuiltinChartType } from '@loopwise/shared/chart-types';
import { displayChart, displayMap } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod/v4';

import { listChartPlugins, readChartPlugin } from '../agent/services/chart-plugin.js';
import { ChatRepository } from '../chats/chat.repository.js';
import { ChatAccessService } from '../chats/chat-access.service.js';
import { ClinicRepository } from '../clinics/clinic.repository.js';
import { HandlerError } from '../common/errors/handler-error.js';
import type { Clinic } from '../generated/prisma/client.js';
import { ChartRepository } from './chart.repository.js';
import { generateChartImage } from './components/generate-chart.js';

const chartPluginSourceSchema = z.object({
	type: z.string().regex(/^[a-z][a-z0-9_-]*$/),
	version: z.string(),
});

/**
 * Port of upstream `routes/chart.ts`, `routes/image.ts`, and the tRPC `chart`, `map` and `chartPlugin` routers.
 * Analytics events (`logAnalyticsEvent` on download) are not ported.
 */
@Injectable()
export class ChartsService {
	constructor(
		private readonly charts: ChartRepository,
		private readonly chats: ChatRepository,
		private readonly clinics: ClinicRepository,
		private readonly chatAccess: ChatAccessService,
	) {}

	/** `GET /c/:chatId/:chartId.png`: the stored PNG of a chart (public, like upstream). */
	async getChartPng(chartId: string): Promise<Buffer> {
		const imageData = await this.charts.getChartById(chartId);
		if (!imageData) {
			throw new HandlerError('NOT_FOUND', 'Chart image not found');
		}
		return Buffer.from(imageData, 'base64');
	}

	/** `GET /i/:imageId`: an image attached to a message, for whoever can view a chat that shows it. */
	async getImageForUser(imageId: string, userId: string): Promise<{ buffer: Buffer; mediaType: string }> {
		if (!z.uuid().safeParse(imageId).success) {
			throw new HandlerError('BAD_REQUEST', 'Invalid image id');
		}
		if (!(await this.canUserViewImage(imageId, userId))) {
			throw new HandlerError('NOT_FOUND', 'Image not found');
		}

		const image = await this.charts.getImageById(imageId);
		if (!image) {
			throw new HandlerError('NOT_FOUND', 'Image not found');
		}
		if (!image.mediaType.startsWith('image/')) {
			throw new HandlerError('BAD_REQUEST', 'Invalid media type');
		}
		return { buffer: Buffer.from(image.data, 'base64'), mediaType: image.mediaType };
	}

	/** Upstream `chart.download`: renders a built-in chart from its own chat's query data, as a base64 PNG. */
	async downloadChart(toolCallId: string, userId: string): Promise<string> {
		const owner = await this.charts.getChartOwnerInfo(toolCallId);
		if (!owner || !(await this.chatAccess.canUserViewChatContent(owner.chatId, owner.clinicId, userId))) {
			throw new HandlerError('NOT_FOUND', 'Visualization not found.');
		}
		const config = await this.readDownloadableChartConfig(toolCallId);
		const query = await this.chats.getExecuteSqlPartByQueryIdInChat(owner.chatId, config.query_id);
		if (!query) {
			throw new HandlerError('NOT_FOUND', `Query ${config.query_id} not found.`);
		}
		const displaySettings = await this.clinics.getDisplaySettings(owner.clinicId);
		const png = generateChartImage({
			config,
			data: query.toolOutput.data,
			dateFormat: displaySettings.dateFormat,
		});
		return png.toString('base64');
	}

	/** Upstream `chart.updateConfig`: only the chat owner edits a visualization. */
	async updateChartConfig(toolCallId: string, config: unknown, userId: string): Promise<void> {
		const parsed = displayChart.InputSchema.safeParse(config);
		if (!parsed.success) {
			throw new HandlerError('BAD_REQUEST', 'Invalid display config');
		}
		const owner = await this.charts.getChartOwnerInfo(toolCallId);
		if (!owner) {
			throw new HandlerError('NOT_FOUND', 'Visualization not found.');
		}
		if (owner.userId !== userId) {
			throw new HandlerError('FORBIDDEN', 'You are not authorized to edit this visualization.');
		}
		// Upstream stores the input as sent (its zod check only validates).
		await this.charts.updateChartConfig(toolCallId, config as displayChart.Input);
	}

	/** Upstream `map.updateConfig` (`ownedResourceProcedure` + the clinic's boundary sets). */
	async updateMapConfig(
		mapId: string,
		config: unknown,
		userId: string,
		selectedClinicId: string | null,
	): Promise<void> {
		const ownerId = await this.charts.getMapOwnerId(mapId);
		if (!ownerId) {
			throw new HandlerError('NOT_FOUND', 'map not found.');
		}
		if (ownerId !== userId) {
			throw new HandlerError('FORBIDDEN', 'You are not authorized to modify this map.');
		}
		if (typeof config !== 'object' || config === null) {
			throw new HandlerError('BAD_REQUEST', 'Invalid map config');
		}
		const clinic = await this.clinics.getClinicByUserId(userId, selectedClinicId);
		const customSets = clinic ? await this.clinics.getCustomBoundaries(clinic.id) : [];
		const parsed = displayMap.buildInputSchema(customSets).safeParse(config);
		if (!parsed.success) {
			throw new HandlerError('BAD_REQUEST', 'Invalid map config');
		}
		await this.charts.updateMapConfig(mapId, parsed.data);
	}

	/** Upstream `chartPlugin.list`. */
	listChartPlugins(clinic: Clinic): ChartPluginManifestEntry[] {
		return listChartPlugins(clinic.path ?? '');
	}

	/** Upstream `chartPlugin.source`. */
	getChartPluginSource(
		clinic: Clinic,
		input: { type: string; version: string },
	): { source: string; version: string } {
		const parsed = chartPluginSourceSchema.safeParse(input);
		if (!parsed.success) {
			throw new HandlerError('BAD_REQUEST', parsed.error.issues.map((issue) => issue.message).join('; '));
		}
		const plugin = readChartPlugin(clinic.path ?? '', parsed.data.type);
		if (!plugin) {
			throw new HandlerError('NOT_FOUND', `Custom chart "${parsed.data.type}" was not found.`);
		}
		return { source: plugin.source, version: plugin.entry.version };
	}

	private async readDownloadableChartConfig(
		toolCallId: string,
	): Promise<displayChart.BuiltinChartInput | displayChart.KpiCardInput> {
		const config = await this.charts.getDisplayConfigByToolCallId(toolCallId);
		if (displayChart.isTableInput(config)) {
			throw new HandlerError('BAD_REQUEST', 'Chart download is only available for chart visualizations.');
		}
		if (!isBuiltinChartType(config.chart_type)) {
			throw new HandlerError('BAD_REQUEST', 'Custom charts can only be viewed in the interactive web chat.');
		}
		return { ...config, chart_type: config.chart_type };
	}

	private async canUserViewImage(imageId: string, userId: string): Promise<boolean> {
		const chats = await this.charts.listChatsReferencingImage(imageId);
		for (const { chatId, clinicId } of chats) {
			if (await this.chatAccess.canUserViewChatContent(chatId, clinicId, userId)) {
				return true;
			}
		}
		return false;
	}
}
