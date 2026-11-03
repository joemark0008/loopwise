import { Field, InputType } from '@nestjs/graphql';
import { TOOL_CALL_DENSITIES, type ToolCallDensity } from '@quarry/shared/types';
import { IsIn, IsOptional } from 'class-validator';

@InputType()
export class UpdateUserPreferencesInput {
	@Field(() => String, { nullable: true, description: 'compact or detailed' })
	@IsOptional()
	@IsIn(TOOL_CALL_DENSITIES)
	toolCallDensity?: ToolCallDensity;
}
