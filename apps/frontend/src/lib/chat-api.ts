import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import type { ChatFieldsFragment, SharedChatFieldsFragment } from '@/graphql/generated/graphql';
import {
	AskSharedChatDocument,
	CancelChatDocument,
	ChatContextUsageDocument,
	ChatDocument,
	ChatForkMetadataDocument,
	ChatListDocument,
	ChatShareMembersDocument,
	ChatShareOptionsDocument,
	CitationDocument,
	CreateSharedChatDocument,
	DeleteAllNonStarredChatsDocument,
	DeleteChatDocument,
	DeleteSharedChatDocument,
	ForkSharedChatDocument,
	QueryRowsDocument,
	RenameChatDocument,
	SearchChatsDocument,
	SetChatStarredDocument,
	SharedChatDocument,
	SharedChatQuickQuestionsDocument,
	SharedChatsDocument,
	StopChatDocument,
	SubmitMessageFeedbackDocument,
	SwitchMessageVersionDocument,
	UpdateSharedChatAccessDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs;
type Outputs = ApiOutputs;

/**
 * The chat procedures moved to apps/api (`lib/apollo-procedures.ts`): call sites swap upstream tRPC's `chat.*` for
 * `chatApi.chat.*`. Types are upstream's router types until the shared bridge goes away (Phase 8).
 */
export const chatApi = {
	chat: {
		get: query<Inputs['chat']['get'], Outputs['chat']['get']>(['chat', 'get'], async ({ chatId }) =>
			toUIChat((await runQuery(ChatDocument, { chatId })).chat),
		),
		listGrouped: query<Inputs['chat']['listGrouped'], Outputs['chat']['listGrouped']>(
			['chat', 'listGrouped'],
			async (input) => {
				const { chatList } = await runQuery(ChatListDocument, { input });
				return chatList as Outputs['chat']['listGrouped'];
			},
		),
		search: query<Inputs['chat']['search'], Outputs['chat']['search']>(['chat', 'search'], async (input) => {
			const { searchChats } = await runQuery(SearchChatsDocument, input);
			return searchChats.map((result) => ({ ...result, matchedText: result.matchedText ?? undefined }));
		}),
		getForkMetadata: query<Inputs['chat']['getForkMetadata'], Outputs['chat']['getForkMetadata']>(
			['chat', 'getForkMetadata'],
			async ({ chatId }) =>
				(await runQuery(ChatForkMetadataDocument, { chatId }))
					.chatForkMetadata as Outputs['chat']['getForkMetadata'],
		),
		getContextUsage: query<Inputs['chat']['getContextUsage'], Outputs['chat']['getContextUsage']>(
			['chat', 'getContextUsage'],
			async (input) => (await runQuery(ChatContextUsageDocument, { input })).chatContextUsage,
		),
		getQueryRows: query<Inputs['chat']['getQueryRows'], Outputs['chat']['getQueryRows']>(
			['chat', 'getQueryRows'],
			async (input) =>
				(await runQuery(QueryRowsDocument, { input })).queryRows as Outputs['chat']['getQueryRows'],
		),
		delete: mutation<Inputs['chat']['delete'], void>(['chat', 'delete'], async ({ chatId }) => {
			await runMutation(DeleteChatDocument, { chatId });
		}),
		stop: mutation<Inputs['chat']['stop'], void>(['chat', 'stop'], async ({ chatId }) => {
			await runMutation(StopChatDocument, { chatId });
		}),
		cancel: mutation<Inputs['chat']['cancel'], Outputs['chat']['cancel']>(
			['chat', 'cancel'],
			async ({ chatId }) =>
				(await runMutation(CancelChatDocument, { chatId })).cancelChat as Outputs['chat']['cancel'],
		),
		rename: mutation<Inputs['chat']['rename'], void>(['chat', 'rename'], async (input) => {
			await runMutation(RenameChatDocument, { input });
		}),
		deleteAllNonStarred: mutation<void, Outputs['chat']['deleteAllNonStarred']>(
			['chat', 'deleteAllNonStarred'],
			async () => ({ count: (await runMutation(DeleteAllNonStarredChatsDocument, {})).deleteAllNonStarredChats }),
		),
		toggleStarred: mutation<Inputs['chat']['toggleStarred'], void>(['chat', 'toggleStarred'], async (input) => {
			await runMutation(SetChatStarredDocument, input);
		}),
		switchMessageVersion: mutation<Inputs['chat']['switchMessageVersion'], void>(
			['chat', 'switchMessageVersion'],
			async (input) => {
				await runMutation(SwitchMessageVersionDocument, input);
			},
		),
	},
	citation: {
		get: query<Inputs['citation']['get'], Outputs['citation']['get']>(
			['citation', 'get'],
			async (input) => (await runQuery(CitationDocument, input)).citation as Outputs['citation']['get'],
		),
	},
	feedback: {
		submit: mutation<Inputs['feedback']['submit'], Outputs['feedback']['submit']>(
			['feedback', 'submit'],
			async (input) => {
				const { submitMessageFeedback } = await runMutation(SubmitMessageFeedbackDocument, { input });
				return {
					...submitMessageFeedback,
					createdAt: new Date(submitMessageFeedback.createdAt),
				} as Outputs['feedback']['submit'];
			},
		),
	},
	sharedChat: {
		/** Upstream `project.getProjectMembersByChatId`. */
		shareMembers: query<{ chatId: string }, { id: string; name: string; email: string; role: string }[]>(
			['project', 'getProjectMembersByChatId'],
			async ({ chatId }) => (await runQuery(ChatShareMembersDocument, { chatId })).chatShareMembers,
		),
		list: query<void, Outputs['sharedChat']['list']>(['sharedChat', 'list'], async () =>
			(await runQuery(SharedChatsDocument, {})).sharedChats.map(toSharedChat),
		),
		getSharedChat: query<Inputs['sharedChat']['getSharedChat'], Outputs['sharedChat']['getSharedChat']>(
			['sharedChat', 'getSharedChat'],
			async ({ shareId }) => {
				const { sharedChat } = await runQuery(SharedChatDocument, { shareId });
				return {
					share: toSharedChat(sharedChat.share),
					chat: toUIChat(sharedChat.chat),
					userRole: sharedChat.userRole,
				} as Outputs['sharedChat']['getSharedChat'];
			},
		),
		getShareOptionsByChatId: query<
			Inputs['sharedChat']['getShareOptionsByChatId'],
			Outputs['sharedChat']['getShareOptionsByChatId']
		>(['sharedChat', 'getShareOptionsByChatId'], async ({ chatId }) => {
			const { chatShareOptions } = await runQuery(ChatShareOptionsDocument, { chatId });
			return chatShareOptions as Outputs['sharedChat']['getShareOptionsByChatId'];
		}),
		create: mutation<Inputs['sharedChat']['create'], Outputs['sharedChat']['create']>(
			['sharedChat', 'create'],
			async (input) => {
				const { createSharedChat } = await runMutation(CreateSharedChatDocument, { input });
				return toSharedChat(createSharedChat) as Outputs['sharedChat']['create'];
			},
		),
		updateAccess: mutation<Inputs['sharedChat']['updateAccess'], void>(
			['sharedChat', 'updateAccess'],
			async (input) => {
				await runMutation(UpdateSharedChatAccessDocument, input);
			},
		),
		delete: mutation<Inputs['sharedChat']['delete'], void>(['sharedChat', 'delete'], async ({ shareId }) => {
			await runMutation(DeleteSharedChatDocument, { shareId });
		}),
	},
	chatFork: {
		/** Forks of a shared chat. */
		fork: mutation<Inputs['chatFork']['fork'], Outputs['chatFork']['fork']>(
			['chatFork', 'fork'],
			async ({ source, selection }) => {
				const input = { shareId: source.shareId, selection };
				return (await runMutation(ForkSharedChatDocument, { input })).forkSharedChat;
			},
		),
		askSharedChat: mutation<Inputs['chatFork']['askSharedChat'], Outputs['chatFork']['askSharedChat']>(
			['chatFork', 'askSharedChat'],
			async (input) => (await runMutation(AskSharedChatDocument, { input })).askSharedChat,
		),
		listSharedChatQuickQuestions: query<
			Inputs['chatFork']['listSharedChatQuickQuestions'],
			Outputs['chatFork']['listSharedChatQuickQuestions']
		>(['chatFork', 'listSharedChatQuickQuestions'], async ({ shareId }) => {
			const { sharedChatQuickQuestions } = await runQuery(SharedChatQuickQuestionsDocument, { shareId });
			return sharedChatQuickQuestions.map((question) => ({
				chatId: question.chatId,
				title: question.title,
				updatedAt: new Date(question.updatedAt),
			}));
		}),
	},
};

function toUIChat(chat: ChatFieldsFragment): Outputs['chat']['get'] {
	return {
		...chat,
		forkMetadata: chat.forkMetadata ?? undefined,
		automationRun: chat.automationRun ?? undefined,
	} as Outputs['chat']['get'];
}

function toSharedChat(share: SharedChatFieldsFragment): Outputs['sharedChat']['list'][number] {
	return {
		...share,
		createdAt: new Date(share.createdAt),
		forkMetadata: share.forkMetadata ?? undefined,
		messageBubbles: share.messageBubbles ?? undefined,
	} as Outputs['sharedChat']['list'][number];
}
