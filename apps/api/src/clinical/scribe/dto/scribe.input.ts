import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { z } from 'zod/v4';

import { trim } from '../../../common/validators/auth-input.validators.js';

@InputType({ description: "The patient's answer to recording this visit for the AI scribe, asked before recording." })
export class RecordScribeConsentInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field({ description: 'Whether the patient agreed; false records a refusal or withdraws an earlier yes.' })
	@IsBoolean()
	granted: boolean;

	@Field(() => String, { nullable: true, description: 'Who answered, when not the patient (a guardian).' })
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(200)
	signedBy?: string | null;
}

/** `POST /api/scribe/transcribe`: one recording of a visit, as base64 audio. */
export const ScribeTranscribeBodySchema = z.object({
	encounterId: z.uuid(),
	audio: z.string().min(1),
});

export type ScribeTranscribeBody = z.infer<typeof ScribeTranscribeBodySchema>;
