import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { ReviewResultInput } from './dto/review-result.input.js';
import { ResultItem } from './models/result-review.model.js';
import { ResultsService } from './results.service.js';

/** The results inbox and the patient's results. Access is row-level security plus the reviewer check in the service. */
@Resolver(() => ResultItem)
export class ResultsResolver {
	constructor(private readonly results: ResultsService) {}

	@Query(() => [ResultItem], { description: 'Results waiting for your review: critical first, then abnormal.' })
	resultsToReview(@CurrentUser() user: AuthUser): Promise<ResultItem[]> {
		return this.results.toReview(user.id);
	}

	@Query(() => [ResultItem], { description: "The patient's results you can see, newest first." })
	patientResults(
		@CurrentUser() user: AuthUser,
		@Args('patientId', { type: () => ID }) patientId: string,
	): Promise<ResultItem[]> {
		return this.results.forPatient(user.id, patientId);
	}

	@Mutation(() => ResultItem, { description: 'Marks a result reviewed (audited, with the optional note).' })
	reviewResult(@CurrentUser() user: AuthUser, @Args('input') input: ReviewResultInput): Promise<ResultItem> {
		return this.results.review(user.id, input);
	}
}
