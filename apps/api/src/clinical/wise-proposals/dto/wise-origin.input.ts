import { Field, ID, InputType } from '@nestjs/graphql';
import { IsBoolean, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

/**
 * The Wise card a mutation confirms (DESIGN.md §9.1). The API checks it against the stored chat: the tool call must be
 * in the user's own chat, made by that tool, and not settled yet. Manual forms leave it out.
 */
@InputType()
export class WiseOriginInput {
	@Field(() => ID)
	@IsUUID()
	chatId: string;

	@Field(() => ID)
	@IsString()
	@MaxLength(200)
	toolCallId: string;

	@Field({ description: 'The proposal tool, e.g. `propose_encounter_note`.' })
	@Matches(/^propose_[a-z_]+$/)
	toolName: string;

	@Field({ description: "Whether the clinician changed Wise's draft before confirming." })
	@IsBoolean()
	edited: boolean;
}
