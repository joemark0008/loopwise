import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { ReportPdf } from '../insights/models/report-pdf.model.js';
import { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { ClinicalDocument } from './models/clinical-document.model.js';
import { ReportsService } from './reports.service.js';

/** Wise reports leaving the system as a PDF (DESIGN.md §9.2). */
@Resolver()
export class ReportsResolver {
	constructor(private readonly service: ReportsService) {}

	@Mutation(() => ReportPdf, {
		description: 'Prints one version of a Wise report in your own chat to PDF; audited as `report.export`.',
	})
	exportWiseReportPdf(
		@CurrentUser() user: AuthUser,
		@Args('chatId', { type: () => ID }) chatId: string,
		@Args('toolCallId') toolCallId: string,
	): Promise<ReportPdf> {
		return this.service.exportPdf(user.id, chatId, toolCallId);
	}

	@Mutation(() => ClinicalDocument, {
		description: "Saves one version of a Wise report about one patient to that patient's chart (once per version).",
	})
	saveReportToChart(
		@CurrentUser() user: AuthUser,
		@Args('chatId', { type: () => ID }) chatId: string,
		@Args('toolCallId') toolCallId: string,
		@Args('wiseOrigin', { type: () => WiseOriginInput, nullable: true }) wiseOrigin?: WiseOriginInput | null,
	): Promise<ClinicalDocument> {
		return this.service.saveToChart(user.id, chatId, toolCallId, wiseOrigin);
	}

	@Query(() => ClinicalDocument, { nullable: true, description: 'The chart document a report version was saved as.' })
	savedReportDocument(
		@CurrentUser() user: AuthUser,
		@Args('toolCallId') toolCallId: string,
	): Promise<ClinicalDocument | null> {
		return this.service.savedDocument(user.id, toolCallId);
	}

	@Query(() => [ClinicalDocument], { description: "A patient's saved documents, newest first." })
	patientDocuments(
		@CurrentUser() user: AuthUser,
		@Args('patientId', { type: () => ID }) patientId: string,
	): Promise<ClinicalDocument[]> {
		return this.service.patientDocuments(user.id, patientId);
	}

	@Query(() => ClinicalDocument, { nullable: true, description: 'One saved document; audited as `document.view`.' })
	clinicalDocument(
		@CurrentUser() user: AuthUser,
		@Args('id', { type: () => ID }) id: string,
	): Promise<ClinicalDocument | null> {
		return this.service.document(user.id, id);
	}
}
