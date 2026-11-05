import { Args, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { Barangay, Icd10Code } from './models/reference.model.js';
import { ReferenceService } from './reference.service.js';

/** ICD-10 and PSGC lookups for the forms. */
@Resolver()
export class ReferenceResolver {
	constructor(private readonly reference: ReferenceService) {}

	@Query(() => [Icd10Code], { description: 'Common ICD-10 codes by code prefix or title words.' })
	searchIcd10(@Args('query') query: string): Icd10Code[] {
		return this.reference.searchIcd10(query);
	}

	@Query(() => [Barangay], { description: 'The barangays of a city or municipality (PSGC code), by name.' })
	barangays(
		@CurrentUser() user: AuthUser,
		@Args('cityMunicipalityCode') cityMunicipalityCode: string,
	): Promise<Barangay[]> {
		return this.reference.listBarangays(user.id, cityMunicipalityCode);
	}
}
