import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import type { AuthUser } from '../auth/auth.service.js';
import { ClinicAccess } from '../common/decorators/access.decorator.js';
import { CurrentClinic, CurrentUser, SelectedClinicId } from '../common/decorators/current.decorator.js';
import type { Clinic } from '../generated/prisma/client.js';
import { ChartsService } from './charts.service.js';
import { ChartPluginSource } from './models/chart-plugin-source.model.js';

/** Upstream tRPC `chart`, `map` and `chartPlugin` routers. Configs are JSON, validated with upstream's zod schemas. */
@Resolver()
export class ChartsResolver {
	constructor(private readonly charts: ChartsService) {}

	@ClinicAccess()
	@Query(() => String, { description: 'Upstream `chart.download`: the chart rendered as a base64 PNG.' })
	chartDownload(@CurrentUser() user: AuthUser, @Args('toolCallId') toolCallId: string) {
		return this.charts.downloadChart(toolCallId, user.id);
	}

	@Mutation(() => Boolean, { description: 'Upstream `chart.updateConfig`: the chat owner edits a `display_chart`.' })
	async updateChartConfig(
		@CurrentUser() user: AuthUser,
		@Args('toolCallId') toolCallId: string,
		@Args('config', { type: () => GraphQLJSON }) config: unknown,
	) {
		await this.charts.updateChartConfig(toolCallId, config, user.id);
		return true;
	}

	@Mutation(() => Boolean, { description: 'Upstream `map.updateConfig`: the chat owner edits a `display_map`.' })
	async updateMapConfig(
		@CurrentUser() user: AuthUser,
		@SelectedClinicId() selectedClinicId: string | null,
		@Args('mapId') mapId: string,
		@Args('config', { type: () => GraphQLJSON }) config: unknown,
	) {
		await this.charts.updateMapConfig(mapId, config, user.id, selectedClinicId);
		return true;
	}

	@ClinicAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `chartPlugin.list`: the clinic `charts/` plugins.' })
	chartPlugins(@CurrentClinic() clinic: Clinic) {
		return this.charts.listChartPlugins(clinic);
	}

	@ClinicAccess()
	@Query(() => ChartPluginSource, { description: 'Upstream `chartPlugin.source`.' })
	chartPluginSource(@CurrentClinic() clinic: Clinic, @Args('type') type: string, @Args('version') version: string) {
		return this.charts.getChartPluginSource(clinic, { type, version });
	}
}
