import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { InsightsService } from './insights.service.js';
import { ReportPdf } from './models/report-pdf.model.js';

/** Wise summary reports leaving the system as a PDF (DESIGN.md §9.2). */
@Resolver()
export class InsightsResolver {
	constructor(private readonly service: InsightsService) {}

	@Mutation(() => ReportPdf, {
		description: 'Prints a report Wise built in your own chat to PDF; audited as `report.export`.',
	})
	exportReportPdf(
		@CurrentUser() user: AuthUser,
		@Args('chatId', { type: () => ID }) chatId: string,
		@Args('toolCallId') toolCallId: string,
	): Promise<ReportPdf> {
		return this.service.exportReportPdf(user.id, chatId, toolCallId);
	}
}
