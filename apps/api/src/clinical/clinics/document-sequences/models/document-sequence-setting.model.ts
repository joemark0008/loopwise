import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

import { DOCUMENT_SEQUENCE_KEYS, type DocumentSequenceKey } from '../document-sequence.service.js';

export const DOCUMENT_SEQUENCE_LABELS: Record<DocumentSequenceKey, string> = {
	PATIENT: 'Patient number',
	ENCOUNTER: 'Visit number',
	LAB_ORDER: 'Lab order number',
	RX: 'Prescription number',
	MED_CERT: 'Medical certificate number',
	INVOICE: 'Invoice number (without a BIR series)',
	PAYMENT: 'Payment number',
};

@ObjectType({ description: 'How the clinic numbers one kind of document this year (Philippine calendar year).' })
export class DocumentSequenceSetting {
	@Field({ description: 'PATIENT, ENCOUNTER, LAB_ORDER, RX, MED_CERT, INVOICE or PAYMENT.' })
	key: string;

	@Field()
	label: string;

	@Field(() => Int)
	year: number;

	@Field({ description: 'Printed before the number, e.g. TAG-RX-2026-.' })
	prefix: string;

	@Field(() => Int, { description: 'Digits of the number, zero-padded.' })
	padLength: number;

	@Field(() => Int, { description: 'The value the next document gets.' })
	nextValue: number;

	@Field({ description: 'What the next number looks like.' })
	preview: string;

	@Field({ description: 'False until the first number of the year is issued or the format is set.' })
	isStarted: boolean;
}

@InputType()
export class SetDocumentSequenceInput {
	@Field()
	@IsIn(Object.keys(DOCUMENT_SEQUENCE_KEYS))
	key: string;

	@Field({ description: "Letters, digits, '-' and '/', with this year in it (numbers restart every year)." })
	@IsString()
	@MaxLength(24)
	prefix: string;

	@Field(() => Int, { description: '3 to 10 digits.' })
	@IsInt()
	@Min(3)
	@Max(10)
	padLength: number;
}
