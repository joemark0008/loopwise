import { Field, ObjectType } from '@nestjs/graphql';

/** A report printed to PDF, base64-encoded for the GraphQL response (loopwise's `chatDownload` shape). */
@ObjectType()
export class ReportPdf {
	@Field()
	filename: string;

	@Field()
	mimeType: string;

	@Field({ description: 'The PDF, base64.' })
	data: string;
}
