import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { Pathway } from './models/pathway.model.js';
import { ResultEvaluation } from './models/result-evaluation.model.js';
import { toPathwayView } from './pathway-view.js';
import { PathwaysService } from './pathways.service.js';
import { RulesService } from './rules.service.js';

/** Read-only pathways and result evaluations, as the user (DESIGN.md §4.2, §5). Nothing here writes. */
@Resolver()
export class PathwaysResolver {
	constructor(
		private readonly pathwaysService: PathwaysService,
		private readonly rules: RulesService,
	) {}

	@Query(() => [Pathway], { description: 'The active clinical pathways and their rules: bands, steps, SLAs.' })
	async pathways(@CurrentUser() user: AuthUser): Promise<Pathway[]> {
		return (await this.pathwaysService.listForUser(user.id)).map(toPathwayView);
	}

	@Query(() => ResultEvaluation, {
		nullable: true,
		description:
			'Why a result is normal, actionable or critical. Null when none is stored or the user can’t see it.',
	})
	resultEvaluation(
		@CurrentUser() user: AuthUser,
		@Args('resultId', { type: () => ID }) resultId: string,
	): Promise<ResultEvaluation | null> {
		return this.rules.evaluationForUser(user.id, resultId);
	}
}
