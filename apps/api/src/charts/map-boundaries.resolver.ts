import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { ClinicAccess, ClinicAdmin } from '../common/decorators/access.decorator.js';
import { CurrentClinic } from '../common/decorators/current.decorator.js';
import type { Clinic } from '../generated/prisma/client.js';
import { MapBoundariesService } from './map-boundaries.service.js';

/**
 * The clinic's custom map boundary sets (upstream `clinic.getMapBoundaries` … `deleteMapBoundary`). Inputs and
 * results are JSON in upstream's shapes, validated with upstream's zod schemas in the service.
 */
@Resolver()
export class MapBoundariesResolver {
	constructor(private readonly boundaries: MapBoundariesService) {}

	@ClinicAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `clinic.getMapBoundaries`.' })
	mapBoundaries(@CurrentClinic() clinic: Clinic) {
		return this.boundaries.getMapBoundaries(clinic.id);
	}

	@ClinicAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `clinic.validateMapBoundaryUrl`: keys, count, GeoJSON.' })
	validateMapBoundaryUrl(@Args('url') url: string) {
		return this.boundaries.validateMapBoundaryUrl({ url });
	}

	@ClinicAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `clinic.addMapBoundary`: the updated boundary sets.' })
	addMapBoundary(@CurrentClinic() clinic: Clinic, @Args('input', { type: () => GraphQLJSON }) input: unknown) {
		return this.boundaries.addMapBoundary(clinic.id, input);
	}

	@ClinicAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `clinic.updateMapBoundary`: the updated boundary sets.' })
	updateMapBoundary(@CurrentClinic() clinic: Clinic, @Args('input', { type: () => GraphQLJSON }) input: unknown) {
		return this.boundaries.updateMapBoundary(clinic.id, input);
	}

	@ClinicAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `clinic.deleteMapBoundary`: the updated boundary sets.' })
	deleteMapBoundary(@CurrentClinic() clinic: Clinic, @Args('key') key: string) {
		return this.boundaries.deleteMapBoundary(clinic.id, { key });
	}
}
