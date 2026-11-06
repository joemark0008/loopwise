import { Field, ID, InputType, registerEnumType } from '@nestjs/graphql';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { OrderPriority, ReferralStatus } from '../../documents.enums.js';

/** Which referrals: sent to me (inbox), sent by me (outbox), or every one of a clinic (its admins). */
export const ReferralBox = { INBOX: 'INBOX', OUTBOX: 'OUTBOX', CLINIC: 'CLINIC' } as const;
export type ReferralBox = (typeof ReferralBox)[keyof typeof ReferralBox];
registerEnumType(ReferralBox, {
	name: 'ReferralBox',
	description:
		"INBOX: sent to the user's practitioner; OUTBOX: sent by them; CLINIC: every referral of the clinic (admins).",
});

@InputType()
export class ReferralsInput {
	@Field(() => ReferralBox)
	@IsIn(Object.values(ReferralBox))
	box: ReferralBox;

	@Field(() => ID, { nullable: true, description: "Required for CLINIC; for INBOX / OUTBOX, that clinic's visits." })
	@IsOptional()
	@IsUUID()
	clinicId?: string | null;

	@Field(() => [ReferralStatus], { nullable: true, description: 'Default: every status.' })
	@IsOptional()
	@IsIn(Object.values(ReferralStatus), { each: true })
	statuses?: ReferralStatus[] | null;
}

/** Accepting a referral (internal: by the doctor it was sent to; external: marked by the referring clinic). */
@InputType()
export class AcceptReferralInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field(() => String, { nullable: true, description: 'e.g. "Seen on Thursday at the IM clinic".' })
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	notes?: string | null;
}

@InputType()
export class DeclineReferralInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field()
	@IsString()
	@MaxLength(1000)
	reason: string;
}

@InputType()
export class CompleteReferralInput {
	@Field(() => ID)
	@IsUUID()
	id: string;

	@Field({ description: 'What was found or done: the reply to the referring doctor.' })
	@IsString()
	@MaxLength(4000)
	responseNotes: string;
}

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
