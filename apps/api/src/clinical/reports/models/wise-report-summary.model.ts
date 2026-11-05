import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/** The latest version of one Wise report in one of your chats: a row of the reports library (DESIGN.md §7.2). */
@ObjectType()
export class WiseReportSummary {
	@Field(() => ID)
	chatId: string;

	@Field()
	chatTitle: string;

	@Field({ description: "The report's id within its chat (the `report` tool's kebab-case id)." })
	reportId: string;

	@Field()
	title: string;

	@Field(() => Int, { description: 'The latest version.' })
	version: number;

	@Field({ description: 'The tool call of the latest version.' })
	toolCallId: string;

	@Field(() => ID, { nullable: true })
	patientId: string | null;

	@Field(() => String, { nullable: true, description: "The patient's name, when you may still see them." })
	patientName: string | null;

	@Field()
	updatedAt: Date;
}
