import type { listLabOrders, listResultsToReview } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import type { DiagnosticOrderStatus } from '../../generated/prisma/enums.js';
import { ResultsInboxService } from './results/results-inbox.service.js';
import { LabWorklistService } from './worklist/lab-worklist.service.js';

/** The read methods Wise's diagnostics tools call (`list_lab_orders`, `list_results_to_review`), as the user. */
@Injectable()
export class DiagnosticsWiseReader {
	constructor(
		private readonly worklist: LabWorklistService,
		private readonly inbox: ResultsInboxService,
	) {}

	labWorklistForWise(
		userId: string,
		clinicId: string,
		opts: { statuses: readonly listLabOrders.LabWorklistStatus[]; limit: number },
	): Promise<Omit<listLabOrders.Output, '_version'>> {
		return this.worklist.labWorklistForWise(userId, clinicId, {
			statuses: opts.statuses as readonly DiagnosticOrderStatus[],
			limit: opts.limit,
		});
	}

	resultsToReviewForWise(
		userId: string,
		opts: { patientId?: string; urgency?: listResultsToReview.Input['urgency']; limit: number },
	): Promise<Omit<listResultsToReview.Output, '_version'>> {
		return this.inbox.resultsToReviewForWise(userId, opts);
	}
}
