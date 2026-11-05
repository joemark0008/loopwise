import { Field, ID, InputType } from '@nestjs/graphql';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { OrderPriority } from '../../documents.enums.js';

/** A referral from an encounter; parsed with the shared `ReferralDraftSchema` (`@loopwise/shared/medical-certificate`). */
@InputType()
export class CreateReferralInput {
	@Field(() => ID)
	@IsUUID()
	encounterId: string;

	@Field(() => ID, { nullable: true, description: 'Internal referral: a practitioner (`clinicPractitioners`).' })
	@IsOptional()
	@IsUUID()
	toPractitionerId?: string | null;

	@Field(() => String, { nullable: true, description: 'External referral: the doctor.' })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	toExternalDoctor?: string | null;

	@Field(() => String, { nullable: true, description: 'External referral: the hospital or facility.' })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	toFacility?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	specialty?: string | null;

	@Field()
	@IsString()
	@MaxLength(1000)
	reason: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(4000)
	clinicalSummary?: string | null;

	@Field(() => OrderPriority, { nullable: true, description: 'Default ROUTINE.' })
	@IsOptional()
	@IsIn(Object.values(OrderPriority))
	urgency?: OrderPriority | null;
}

@InputType()
export class CancelReferralInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field()
	@IsString()
	@MaxLength(300)
	reason: string;
}
