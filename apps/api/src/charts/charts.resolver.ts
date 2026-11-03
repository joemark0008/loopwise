import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import type { AuthUser } from '../auth/auth.service.js';
import { ProjectAccess } from '../common/decorators/access.decorator.js';
import { CurrentProject, CurrentUser, SelectedProjectId } from '../common/decorators/current.decorator.js';
import type { Project } from '../generated/prisma/client.js';
import { ChartsService } from './charts.service.js';
import { ChartPluginSource } from './models/chart-plugin-source.model.js';

/** Upstream tRPC `chart`, `map` and `chartPlugin` routers. Configs are JSON, validated with upstream's zod schemas. */
@Resolver()
export class ChartsResolver {
	constructor(private readonly charts: ChartsService) {}

	@ProjectAccess()
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
		@SelectedProjectId() selectedProjectId: string | null,
		@Args('mapId') mapId: string,
		@Args('config', { type: () => GraphQLJSON }) config: unknown,
	) {
		await this.charts.updateMapConfig(mapId, config, user.id, selectedProjectId);
		return true;
	}

	@ProjectAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `chartPlugin.list`: the project `charts/` plugins.' })
	chartPlugins(@CurrentProject() project: Project) {
		return this.charts.listChartPlugins(project);
	}

	@ProjectAccess()
	@Query(() => ChartPluginSource, { description: 'Upstream `chartPlugin.source`.' })
	chartPluginSource(
		@CurrentProject() project: Project,
		@Args('type') type: string,
		@Args('version') version: string,
	) {
		return this.charts.getChartPluginSource(project, { type, version });
	}
}
