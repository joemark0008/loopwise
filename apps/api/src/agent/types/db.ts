import type {
	AutomationRun,
	MessageFeedback as DBMessageFeedback,
	MessagePart,
} from '../../generated/prisma/client.js';

/** Upstream's Drizzle row types (`db/abstractSchema`), on the Prisma models. */
export type DBMessagePart = MessagePart;
export type DBAutomationRun = AutomationRun;
export type MessageFeedback = DBMessageFeedback;

/** A message part to insert (upstream `NewMessagePart`); JSON columns take any value. */
export interface NewMessagePart {
	messageId: string;
	order: number;
	type: string;
	text?: string | null;
	reasoningText?: string | null;
	toolCallId?: string | null;
	toolName?: string | null;
	toolState?: string | null;
	toolErrorText?: string | null;
	toolInput?: unknown;
	toolOutput?: unknown;
	toolApprovalId?: string | null;
	toolApprovalApproved?: boolean | null;
	toolApprovalReason?: string | null;
	toolRawInput?: unknown;
	toolProviderMetadata?: unknown;
	providerMetadata?: unknown;
	mediaType?: string | null;
	imageId?: string | null;
	storagePath?: string | null;
	filename?: string | null;
}
