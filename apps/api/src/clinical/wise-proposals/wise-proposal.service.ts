import { Injectable } from '@nestjs/common';
import { type WiseActionMutation, wiseActionToolsFor } from '@quarry/shared/wise-actions';

import { HandlerError } from '../../common/errors/handler-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { WiseToolSettingsService } from '../../wise-tools/wise-tool-settings.service.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { WiseOriginInput } from './dto/wise-origin.input.js';
import { toWiseProposalOutcome, type WiseProposalOutcome } from './models/wise-proposal-outcome.model.js';
import { WiseProposalRepository } from './wise-proposal.repository.js';

type Tx = Prisma.TransactionClient;

/** What the audit row records about a confirmed Wise card (`audit_log.origin`). */
export type WiseOrigin = {
	via: 'wise';
	toolName: string;
	chatId: string;
	messageId: string;
	toolCallId: string;
	edited: boolean;
};

/** A verified card: its audit origin, and the patient of its chat (null outside a chart chat). */
export interface VerifiedWiseCard {
	origin: WiseOrigin;
	chatPatientId: string | null;
}

/** Refuses a card from the chart chat of another patient than the one the change is about. */
export function assertCardPatient(card: VerifiedWiseCard | undefined, patientId: string): void {
	if (card?.chatPatientId && card.chatPatientId !== patientId) {
		throw new HandlerError('BAD_REQUEST', 'This Wise card is about another patient.');
	}
}

/**
 * Server side of "AI drafts, the clinician confirms" (DESIGN.md §9.1). A mutation confirming a Wise card verifies the
 * card first (the user's own chat, the right tool, not settled yet), then settles it in its own transaction, so the
 * change, its audit row and the outcome commit together and a second Confirm (reload, second tab) is refused.
 */
@Injectable()
export class WiseProposalService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly proposals: WiseProposalRepository,
		private readonly toolSettings: WiseToolSettingsService,
	) {}

	/**
	 * Checks a confirm against the stored chat. `toolNames` are the cards that may confirm this mutation; the caller
	 * checks the patient with `assertCardPatient` once it knows it. The tool must still be on in Wise settings (§9.4),
	 * at `facilityId` when the caller knows the facility of the record: a card drafted before an admin turned the tool
	 * off can't be confirmed after.
	 */
	async verify(
		userId: string,
		input: WiseOriginInput,
		opts: { toolNames: readonly string[]; facilityId?: string },
	): Promise<VerifiedWiseCard> {
		if (!opts.toolNames.includes(input.toolName)) {
			throw new HandlerError('BAD_REQUEST', `A ${input.toolName} card can't confirm this change.`);
		}
		await this.toolSettings.assertEnabled(userId, input.toolName, opts.facilityId);
		return this.verifyCall(userId, input);
	}

	/** The tool call is in the user's own chat, by this tool, and not settled yet. */
	private async verifyCall(userId: string, input: WiseOriginInput): Promise<VerifiedWiseCard> {
		const call = await this.proposals.findToolCall(input.toolCallId);
		const chat = call?.chatMessage.chat;
		if (!call || !chat || call.chatMessage.chatId !== input.chatId || chat.userId !== userId) {
			throw new HandlerError('BAD_REQUEST', "This Wise card isn't in your chat.");
		}
		if (call.toolName !== input.toolName) {
			throw new HandlerError('BAD_REQUEST', `This card was drafted by ${call.toolName}, not ${input.toolName}.`);
		}
		const settled = await this.proposals.findOutcome(input.toolCallId);
		if (settled) {
			throw alreadySettled(settled.status);
		}
		return {
			origin: {
				via: 'wise',
				toolName: input.toolName,
				chatId: input.chatId,
				messageId: call.messageId,
				toolCallId: input.toolCallId,
				edited: input.edited,
			},
			chatPatientId: chat.patientId,
		};
	}

	/**
	 * The origin of a write that completes a card confirmed earlier (the vitals and diagnoses of a confirmed
	 * `propose_encounter`): the card must be confirmed into `resourceId`. It isn't settled again.
	 */
	async verifyFollowUp(
		userId: string,
		input: WiseOriginInput,
		opts: { toolNames: readonly string[]; resourceId: string },
	): Promise<WiseOrigin> {
		if (!opts.toolNames.includes(input.toolName)) {
			throw new HandlerError('BAD_REQUEST', `A ${input.toolName} card can't confirm this change.`);
		}
		const outcome = await this.proposals.findOutcome(input.toolCallId);
		if (
			!outcome ||
			outcome.userId !== userId ||
			outcome.chatId !== input.chatId ||
			outcome.toolName !== input.toolName ||
			outcome.status !== 'confirmed' ||
			outcome.resourceId !== opts.resourceId
		) {
			throw new HandlerError('BAD_REQUEST', "This Wise card wasn't confirmed into this record.");
		}
		return {
			via: 'wise',
			toolName: outcome.toolName,
			chatId: outcome.chatId,
			messageId: outcome.messageId,
			toolCallId: outcome.toolCallId,
			edited: input.edited,
		};
	}

	/**
	 * The Wise action card behind `mutation` (DESIGN.md §9.4), or undefined without one: verified from the tools the
	 * action registry names for it, at the record's facility. Callers run it once they have read the record (it may run
	 * inside their transaction) and `settleAction` after the change.
	 */
	async verifyAction(
		userId: string,
		origin: WiseOriginInput | null | undefined,
		mutation: WiseActionMutation,
		facilityId: string | undefined,
	): Promise<VerifiedWiseCard | undefined> {
		return origin
			? this.verify(userId, origin, { toolNames: wiseActionToolsFor(mutation), facilityId })
			: undefined;
	}

	/** `settle` for an action card, when there is one. */
	async settleAction(
		tx: Tx,
		userId: string,
		card: VerifiedWiseCard | undefined,
		resource: { resource: string; resourceId: string },
	): Promise<void> {
		if (card) {
			await this.settle(tx, userId, card, resource);
		}
	}

	/** Records the card as confirmed in the caller's transaction; a card settled meanwhile rolls the change back. */
	async settle(tx: Tx, userId: string, card: VerifiedWiseCard, resource: { resource: string; resourceId: string }) {
		await this.insert(tx, userId, card.origin, 'confirmed', resource);
	}

	/** Cancel on a card: settles it, so it can't be confirmed later, from this tab or another. */
	async cancel(userId: string, input: WiseOriginInput): Promise<WiseProposalOutcome> {
		// Cancel stays possible for a tool turned off since the draft.
		const { origin } = await this.verifyCall(userId, input);
		return this.db.asUser(userId, async (tx) =>
			toWiseProposalOutcome(await this.insert(tx, userId, origin, 'cancelled')),
		);
	}

	async outcomes(userId: string, chatId: string): Promise<WiseProposalOutcome[]> {
		return (await this.proposals.listOutcomes(userId, chatId)).map(toWiseProposalOutcome);
	}

	private async insert(
		tx: Tx,
		userId: string,
		origin: WiseOrigin,
		status: 'confirmed' | 'cancelled',
		resource?: { resource: string; resourceId: string },
	) {
		try {
			return await this.proposals.insertOutcome(tx, {
				userId,
				chatId: origin.chatId,
				messageId: origin.messageId,
				toolCallId: origin.toolCallId,
				toolName: origin.toolName,
				status,
				resource: resource?.resource ?? null,
				resourceId: resource?.resourceId ?? null,
				edited: origin.edited,
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				throw alreadySettled((await this.proposals.findOutcome(origin.toolCallId))?.status ?? 'confirmed');
			}
			throw error;
		}
	}
}

const alreadySettled = (status: string) =>
	new HandlerError(
		'CONFLICT',
		status === 'cancelled'
			? 'This Wise card was cancelled, so it can no longer be confirmed. Ask Wise for a new draft.'
			: 'This Wise card was already confirmed; nothing was saved twice.',
	);
