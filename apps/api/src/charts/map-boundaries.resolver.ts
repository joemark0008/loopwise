import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { ProjectAccess, ProjectAdmin } from '../common/decorators/access.decorator.js';
import { CurrentProject } from '../common/decorators/current.decorator.js';
import type { Project } from '../generated/prisma/client.js';
import { MapBoundariesService } from './map-boundaries.service.js';

/**
 * The project's custom map boundary sets (upstream `project.getMapBoundaries` … `deleteMapBoundary`). Inputs and
 * results are JSON in upstream's shapes, validated with upstream's zod schemas in the service.
 */
@Resolver()
export class MapBoundariesResolver {
	constructor(private readonly boundaries: MapBoundariesService) {}

	@ProjectAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `project.getMapBoundaries`.' })
	mapBoundaries(@CurrentProject() project: Project) {
		return this.boundaries.getMapBoundaries(project.id);
	}

	@ProjectAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `project.validateMapBoundaryUrl`: keys, count, GeoJSON.' })
	validateMapBoundaryUrl(@Args('url') url: string) {
		return this.boundaries.validateMapBoundaryUrl({ url });
	}

	@ProjectAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `project.addMapBoundary`: the updated boundary sets.' })
	addMapBoundary(@CurrentProject() project: Project, @Args('input', { type: () => GraphQLJSON }) input: unknown) {
		return this.boundaries.addMapBoundary(project.id, input);
	}

	@ProjectAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `project.updateMapBoundary`: the updated boundary sets.' })
	updateMapBoundary(@CurrentProject() project: Project, @Args('input', { type: () => GraphQLJSON }) input: unknown) {
		return this.boundaries.updateMapBoundary(project.id, input);
	}

	@ProjectAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `project.deleteMapBoundary`: the updated boundary sets.' })
	deleteMapBoundary(@CurrentProject() project: Project, @Args('key') key: string) {
		return this.boundaries.deleteMapBoundary(project.id, { key });
	}
}
