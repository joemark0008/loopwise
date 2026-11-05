import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../../auth/auth.service.js';
import { CurrentUser } from '../../../common/decorators/current.decorator.js';
import { ReviewResultInput } from './dto/review-result.input.js';
import { DiagnosticReport } from './models/diagnostic-report.model.js';
import { ResultsInboxService } from './results-inbox.service.js';

/** The results inbox and the patient's results. Access is row-level security plus the reviewer check. */
@Resolver(() => DiagnosticReport)
export class ResultsResolver {
	constructor(private readonly inbox: ResultsInboxService) {}

	@Query(() => [DiagnosticReport], { description: 'Released results waiting for your review: critical first.' })
	resultsToReview(@CurrentUser() user: AuthUser): Promise<DiagnosticReport[]> {
		return this.inbox.toReview(user.id);
	}

	@Query(() => [DiagnosticReport], { description: "The patient's released results you can see, newest first." })
	patientResults(
		@CurrentUser() user: AuthUser,
		@Args('patientId', { type: () => ID }) patientId: string,
	): Promise<DiagnosticReport[]> {
		return this.inbox.forPatient(user.id, patientId);
	}

	@Mutation(() => DiagnosticReport, { description: 'Marks a released result reviewed (audited, with the note).' })
	reviewResult(@CurrentUser() user: AuthUser, @Args('input') input: ReviewResultInput): Promise<DiagnosticReport> {
		return this.inbox.review(user.id, input);
	}
}
