import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../auth/auth.service.js';
import { OrgAdmin } from '../common/decorators/access.decorator.js';
import { CurrentOrganization, CurrentUser } from '../common/decorators/current.decorator.js';
import type { Organization } from '../generated/prisma/client.js';
import { CreateFacilityKeyInput } from './dto/create-facility-key.input.js';
import { FacilityKeyService } from './facility-key.service.js';
import { CreatedFacilityKey, FacilityKey } from './models/facility-key.model.js';

/** Organization admins issue and revoke the keys their facility systems (LIS/RIS connectors) send with. */
@Resolver(() => FacilityKey)
export class FacilityKeysResolver {
	constructor(private readonly service: FacilityKeyService) {}

	@OrgAdmin({ strict: true })
	@Query(() => [FacilityKey], { description: "The organization's facility keys (admins only)." })
	facilityKeys(@CurrentOrganization() org: Organization): Promise<FacilityKey[]> {
		return this.service.list(org.id);
	}

	@OrgAdmin({ strict: true })
	@Mutation(() => CreatedFacilityKey, { description: 'Issues a facility key; the key is shown only in this reply.' })
	createFacilityKey(
		@CurrentOrganization() org: Organization,
		@CurrentUser() user: AuthUser,
		@Args('input') input: CreateFacilityKeyInput,
	): Promise<CreatedFacilityKey> {
		return this.service.create(org.id, user.id, input.name);
	}

	@OrgAdmin({ strict: true })
	@Mutation(() => Boolean, { description: 'Revokes a facility key: requests with it get 401 from now on.' })
	revokeFacilityKey(
		@CurrentOrganization() org: Organization,
		@Args('id', { type: () => ID }) id: string,
	): Promise<boolean> {
		return this.service.revoke(org.id, id);
	}
}
