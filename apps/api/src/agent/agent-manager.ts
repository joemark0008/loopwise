import { randomUUID } from 'node:crypto';

import {
	getSchemaKeyFromMentionId,
	isSchemaMentionId,
	isSkillGranted,
	isStoryFolderMentionId,
	isStoryReferenceMentionId,
	normalizeCitationMarkers,
} from '@loopwise/shared';
import { fileExtension } from '@loopwise/shared/attachments';
import type { CitationData, LlmProvider, LlmSelectedModel } from '@loopwise/shared/types';
import {
	convertToModelMessages,
	createUIMessageStream,
	generateText,
	type InferUIMessageChunk,
	type ModelMessage,
	pruneMessages,
	stepCountIs,
	type StopCondition,
	type StreamTextResult,
	ToolLoopAgent,
	type UIMessageStreamWriter,
} from 'ai';

import type { ChatRepository } from '../chats/chat.repository.js';
import type { LlmInferenceService } from '../usage/llm-inference.service.js';
import type { LlmService } from './llm/llm.service.js';
import {
	disableModelReasoning,
	fitThinkingBudget,
	getProviderMeta,
	type ProviderModelResult,
} from './providers/providers.js';
import { type CompactionService, RunCompaction } from './services/compaction.js';
import { interactiveStopConditions } from './stop-conditions.js';
import { llmTelemetry } from './telemetry.js';
import type { AgentSettings } from './types/agent-settings.js';
import type {
	AgentTools,
	ForkMetadata,
	Mention,
	MessageCustomDataParts,
	TokenUsage,
	UIMessage,
	UIMessagePart,
} from './types/chat.js';
import type { QueryResult, ToolContext } from './types/tools.js';
import { getTableColumnsContent, listSchemaTableFqdns } from './user-rules.js';
import { convertToTokenUsage, findLastUserMessage, getLastUserMessageText, settleToolParts } from './utils/ai.js';
import { normalizeCitationMarkersStream } from './utils/citation-markers-stream.js';
import { logger } from './utils/logger.js';
import { sanitizeToolCalls } from './utils/model-message.js';
import { addPromptCache, cachedSystemInstructions } from './utils/prompt-cache.js';
import { sanitizeTitle, TITLE_MAX_OUTPUT_TOKENS, titleFromPrompt, titleGenerationUserMessage } from './utils/title.js';
import { isStoragePath } from './utils/tools.js';
import { formatErrorMessageForUI, truncateMiddle } from './utils/utils.js';

export const MAX_OUTPUT_TOKENS = 16_000;

const MAX_SCHEMA_TABLES_WITH_COLUMNS = 15;
const MAX_SCHEMA_TABLES_NAMED = 200;

export interface AgentChat {
	id: string;
	clinicId: string;
	userId: string;
	forkMetadata?: ForkMetadata | null;
}

/** How a run is set up (upstream `agents/profiles/types.ts` `AgentProfile`, the web chat's `defaultProfile`). */
export interface AgentProfile {
	source?: UIMessage['source'];
	/** Ends non-interactive runs after this many steps instead of when the agent suggests follow-ups. */
	maxSteps?: number;
	/** The run's tool set; defaults to the analytics tools. */
	tools?: (context: { agentSettings: AgentSettings | null }) => Record<string, unknown>;
	/** Replaces the clinic system prompt (RULES.md, memories, connections) for runs with a dedicated purpose. */
	systemPrompt?: (context: { timezone?: string }) => string;
	/** Background runs (context recommendations) don't extract memories from their own prompt. */
	skipMemoryExtraction?: boolean;
}

export interface AgentManagerDependencies {
	chats: ChatRepository;
	llm: LlmService;
	compaction: CompactionService;
	/** `scheduleSaveLlmInferenceRecord`: the usage of the title generation. */
	inferences: Pick<LlmInferenceService, 'scheduleSave'>;
	/** `imageQueries.getImageById`: an attached image's data, inlined for the model. */
	getImageById: (id: string) => Promise<{ data: string; mediaType: string } | undefined>;
	/** Renders the clinic system prompt for the run (`_buildDefaultSystemPrompt`). */
	buildSystemPrompt: (args: { toolNames: string[]; timezone?: string }) => Promise<string>;
	/** `skillService.getSkillContent`: the raw file of a clinic skill mentioned with `/`. */
	getSkillContent?: (skillName: string) => string | null;
	/** `memoryService.safeScheduleMemoryExtraction`, called once the request reaches the model. */
	scheduleMemoryExtraction?: (args: { messages: UIMessage[]; provider: LlmProvider; modelId: string }) => void;
}

/**
 * Port of upstream `services/agent.ts` `AgentManager`: one agent run on a chat. It streams the answer as an AI SDK
 * UI message stream, persists the assistant message when the run ends (stopped or not), and generates the chat
 * title for a new chat. Long conversations are compacted (`RunCompaction` in the step preparation, summary rebuilt
 * from the last `data-compaction` part). Memory extraction is scheduled once the request is sent and `/` skill
 * mentions are expanded in the last user message. Loopwise dropped loopwise's story mode, story references and
 * conversation artifacts with the stories module.
 * Not ported: PostHog tracking.
 */
export class AgentManager {
	private readonly _agent: ToolLoopAgent<never, AgentTools, never>;
	private readonly _finished: Promise<void>;
	private _resolveFinished: (() => void) | undefined;
	private _streamWriter?: UIMessageStreamWriter<UIMessage>;
	private _systemPrompt = '';
	private _runCompaction: RunCompaction;

	constructor(
		readonly chat: AgentChat,
		private readonly _profile: AgentProfile,
		private readonly _modelConfig: ProviderModelResult,
		private readonly _modelSelection: LlmSelectedModel,
		private readonly _onDispose: () => void,
		private readonly _abortController: AbortController,
		private readonly _agentTools: AgentTools,
		private readonly _toolContext: ToolContext,
		private readonly _deps: AgentManagerDependencies,
	) {
		this._runCompaction = new RunCompaction(this._deps.compaction);
		this._finished = new Promise((resolve) => {
			this._resolveFinished = resolve;
		});
		const callSettings = this._modelConfig.callSettings ?? {};
		const providerOptions = fitThinkingBudget(this._modelConfig.providerOptions, this._maxOutputTokens);
		this._agent = new ToolLoopAgent({
			model: this._modelConfig.model,
			providerOptions,
			tools: this._agentTools,
			maxOutputTokens: this._maxOutputTokens,
			...(callSettings.temperature !== undefined && { temperature: callSettings.temperature }),
			...(callSettings.topP !== undefined && { topP: callSettings.topP }),
			...(callSettings.topK !== undefined && { topK: callSettings.topK }),
			prepareCall: async (args) => ({
				...args,
				instructions: cachedSystemInstructions(this._systemPrompt, this._modelSelection),
			}),
			prepareStep: async ({ messages }) => this._prepareStep(messages),
			stopWhen: this._stopConditions,
			experimental_context: this._toolContext,
			experimental_telemetry: llmTelemetry('loopwise-agent', {
				sessionId: this.chat.id,
				userId: this.chat.userId,
				tags: [this._modelSelection.provider],
				clinicId: this.chat.clinicId,
				model: this._modelSelection.modelId,
			}),
		});
	}

	private get _maxOutputTokens(): number {
		return this._modelConfig.callSettings?.maxOutputTokens ?? MAX_OUTPUT_TOKENS;
	}

	private get _stopConditions(): StopCondition<AgentTools>[] {
		return this._profile.maxSteps ? [stepCountIs(this._profile.maxSteps)] : interactiveStopConditions;
	}

	private async _prepareStep(messages: ModelMessage[]): Promise<{ messages: ModelMessage[] }> {
		const workingMessages: ModelMessage[] =
			this._systemPrompt && messages[0]?.role !== 'system'
				? [{ role: 'system', content: this._systemPrompt }, ...messages]
				: messages;
		await this._runCompaction.apply({
			chat: this.chat,
			provider: this._modelSelection.provider,
			modelId: this._modelSelection.modelId,
			messages: workingMessages,
			tools: this._agentTools,
			maxOutputTokens: this._maxOutputTokens,
			contextWindow: this._modelConfig.contextWindow,
			onCompactionStarted: () => {
				this._streamWriter?.write({ type: 'data-compactionSummaryStarted', data: null });
			},
			onCompactionFinished: (result) => {
				this._streamWriter?.write({ type: 'data-compaction', data: result });
			},
		});

		const conversationMessages = workingMessages[0]?.role === 'system' ? workingMessages.slice(1) : workingMessages;
		return { messages: this._addCache(this._pruneMessages(conversationMessages)) };
	}

	get generatedArtifacts(): ToolContext['generatedArtifacts'] {
		return this._toolContext.generatedArtifacts;
	}

	getQueryResult(queryId: string): QueryResult | undefined {
		return this._toolContext.queryResults.get(queryId);
	}

	stream(
		uiMessages: UIMessage[],
		opts: {
			events?: Partial<MessageCustomDataParts>;
			mentions?: Mention[];
			timezone?: string;
		} = {},
	): ReadableStream<InferUIMessageChunk<UIMessage>> {
		let error: unknown = undefined;
		let result: StreamTextResult<AgentTools, never> | undefined;
		const assistantMessageId = randomUUID();
		const handleError = (err: unknown): string => {
			error = err;
			logger.error(`Agent stream error: ${String(err)}`, {
				source: 'agent',
				clinicId: this.chat.clinicId,
				context: { chatId: this.chat.id, modelId: this._modelSelection.modelId },
			});
			return formatErrorMessageForUI(err);
		};

		return createUIMessageStream<UIMessage>({
			execute: async ({ writer }) => {
				writer.write({ type: 'start', messageId: assistantMessageId });
				if (opts.events?.newChat) {
					writer.write({ type: 'data-newChat', data: opts.events.newChat });
				}
				if (opts.events?.newUserMessage) {
					writer.write({ type: 'data-newUserMessage', data: opts.events.newUserMessage });
				}

				this._streamWriter = writer;
				const messages = await this._buildModelMessages(uiMessages, opts.mentions, opts.timezone);
				result = await this._agent.stream({
					messages,
					abortSignal: this._abortController.signal,
					experimental_transform: normalizeCitationMarkersStream(),
				});

				// Extract memory immediately after the request to the agent is sent
				this._scheduleMemoryExtraction(uiMessages);

				if (opts.events?.newChat) {
					this._scheduleTitleGeneration(getLastUserMessageText(uiMessages));
				}

				writer.merge(result.toUIMessageStream({ sendStart: false, onError: handleError }));
			},
			onError: handleError,
			onFinish: async (event) => {
				try {
					const stopReason = event.isAborted ? 'interrupted' : event.finishReason;
					const tokenUsage = await this._getTotalUsage(result);
					const [settledMessage] = await settleToolParts([event.responseMessage]);
					await this._deps.chats.upsertMessage({
						...settledMessage,
						chatId: this.chat.id,
						senderUserId: this.chat.userId,
						source: this._profile.source,
						stopReason,
						error,
						tokenUsage,
						llmProvider: this._modelSelection.provider,
						llmModelId: this._modelSelection.modelId,
					});
				} catch (persistError) {
					logger.error(`Failed to save the assistant message: ${String(persistError)}`, {
						source: 'agent',
						clinicId: this.chat.clinicId,
						context: { chatId: this.chat.id },
					});
				} finally {
					this._finish();
				}
			},
		});
	}

	/** Runs the agent to completion without streaming (subagents, automations). */
	async generate(uiMessages: UIMessage[], opts: { timezone?: string } = {}) {
		const messages = await this._buildModelMessages(uiMessages, undefined, opts.timezone);
		try {
			const result = await this._agent.generate({ messages, abortSignal: this._abortController.signal });
			return {
				text: normalizeCitationMarkers(result.text),
				usage: convertToTokenUsage(result.totalUsage),
				finishReason: result.finishReason ?? 'stop',
				responseMessages: result.response.messages,
				queryResults: this._toolContext.queryResults,
			};
		} finally {
			this._finish();
		}
	}

	checkIsUserOwner(userId: string): boolean {
		return this.chat.userId === userId;
	}

	stop(): void {
		this._abortController.abort();
	}

	get isStopped(): boolean {
		return this._abortController.signal.aborted;
	}

	waitUntilFinished(): Promise<void> {
		return this._finished;
	}

	getModelId(): string {
		return this._modelSelection.modelId;
	}

	/** Prepares the UI messages and converts them to model messages (`_buildModelMessages`). */
	private async _buildModelMessages(
		uiMessages: UIMessage[],
		mentions?: Mention[],
		timezone?: string,
	): Promise<ModelMessage[]> {
		const settled = await settleToolParts(uiMessages);
		const withSkills = this._addSkills(settled, mentions);
		const withCitation = this._addCitationContext(withSkills);
		const withDbContext = this._addDatabaseContext(withCitation, mentions);
		const withCompaction = this._deps.compaction.useLastCompaction(withDbContext);
		const withResolvedAttachments = await resolveAttachments(withCompaction, this._deps.getImageById);

		this._systemPrompt = await this._deps.buildSystemPrompt({ toolNames: Object.keys(this._agentTools), timezone });
		this._runCompaction = new RunCompaction(this._deps.compaction);
		const conversation = withResolvedAttachments.filter((message) => message.role !== 'system');
		const modelMessages = await convertToModelMessages<UIMessage>(conversation, { tools: this._agentTools });
		return sanitizeToolCalls(modelMessages, this._modelSelection.provider);
	}

	private _scheduleTitleGeneration(userMessageText: string): void {
		this._generateTitle(userMessageText).catch((err) => {
			logger.error(`Title generation failed: ${String(err)}`, {
				source: 'agent',
				clinicId: this.chat.clinicId,
				context: { chatId: this.chat.id },
			});
		});
	}

	private async _generateTitle(userMessageText: string): Promise<void> {
		const { llm, chats } = this._deps;
		const pinned = await llm.resolveDefaultModelSelection(this.chat.clinicId, 'title');
		const provider: LlmProvider = pinned?.provider ?? this._modelSelection.provider;
		const summaryModelId =
			pinned?.modelId ??
			(await llm.resolveAnnotationModelId(
				this.chat.clinicId,
				this._modelSelection,
				getProviderMeta(provider).summaryModelId,
			));
		const modelResult = await llm.resolveProviderModel(this.chat.clinicId, provider, summaryModelId, false);
		if (!modelResult) {
			return;
		}

		const { text, usage } = await generateText({
			...disableModelReasoning(provider, modelResult),
			system: 'Generate a short, descriptive title (3-8 words) for this conversation based on the user message. Always generate a title, no matter the input. Only capitalize the first letter of the title and nouns. Answer with the title alone, without quotes or any other text.',
			messages: [{ role: 'user', content: titleGenerationUserMessage(userMessageText) }],
			maxOutputTokens: TITLE_MAX_OUTPUT_TOKENS,
			experimental_telemetry: llmTelemetry('loopwise-generate-title', {
				sessionId: this.chat.id,
				userId: this.chat.userId,
				tags: [provider],
			}),
		});
		this._trackTitleGenerationInference(provider, summaryModelId, convertToTokenUsage(usage));

		const title = sanitizeTitle(text) || titleFromPrompt(userMessageText);
		if (!title) {
			return;
		}
		await chats.renameChat(this.chat.id, title);
		try {
			this._streamWriter?.write({ type: 'data-chatTitleUpdate', data: { title } });
		} catch {
			// The stream may already be closed: the database is updated regardless.
		}
	}

	private _trackTitleGenerationInference(provider: LlmProvider, modelId: string, usage: TokenUsage): void {
		this._deps.inferences.scheduleSave({
			type: 'title_generation',
			clinicId: this.chat.clinicId,
			userId: this.chat.userId,
			chatId: this.chat.id,
			llmProvider: provider,
			llmModelId: modelId,
			...usage,
		});
	}

	private async _getTotalUsage(
		result: StreamTextResult<AgentTools, never> | undefined,
	): Promise<TokenUsage | undefined> {
		if (!result) {
			return undefined;
		}
		try {
			return convertToTokenUsage(await result.totalUsage);
		} catch {
			return undefined;
		}
	}

	private _markFinished(): void {
		this._resolveFinished?.();
		this._resolveFinished = undefined;
	}

	private _finish(): void {
		try {
			this._onDispose();
		} finally {
			this._markFinished();
		}
	}

	private _addCitationContext(messages: UIMessage[]): UIMessage[] {
		const [lastUserMessage] = findLastUserMessage(messages);
		if (!lastUserMessage?.citation) {
			return messages;
		}
		const context = describeCitation(lastUserMessage.citation);
		return this._transformLastUserMessageText(messages, (text) => (text ? `${context}\n\n${text}` : context));
	}

	private _scheduleMemoryExtraction(uiMessages: UIMessage[]): void {
		if (this._profile.skipMemoryExtraction) {
			return;
		}
		this._deps.scheduleMemoryExtraction?.({
			messages: uiMessages,
			provider: this._modelSelection.provider,
			modelId: this._modelSelection.modelId,
		});
	}

	private _addSkills(messages: UIMessage[], mentions?: Mention[]): UIMessage[] {
		const skillMention = mentions?.find(
			(mention) => mention.trigger === '/' && isSkillGranted(this._toolContext.skillsAccess, mention.id),
		);
		const skillContent = skillMention ? this._deps.getSkillContent?.(skillMention.id) : undefined;
		if (!skillMention || !skillContent) {
			return messages;
		}
		const skill = truncateMiddle(skillContent, 16_000);
		return this._transformLastUserMessageText(messages, (text) =>
			this._expandSkillMention(text, skillMention, skill),
		);
	}

	private _expandSkillMention(text: string, mention: Mention, skill: string): string {
		const tokens = [`${mention.trigger}[${mention.label}]`, `${mention.trigger}[${mention.id}]`];
		const matchedToken = tokens.find((token) => text.includes(token));
		if (matchedToken) {
			return text.replaceAll(matchedToken, () => skill).trim();
		}
		const rest = text.trim();
		return rest ? `${skill}\n\n${rest}` : skill;
	}

	private _addDatabaseContext(messages: UIMessage[], mentions?: Mention[]): UIMessage[] {
		const mentionIds = mentions?.filter((mention) => mention.trigger === '@').map((mention) => mention.id) ?? [];
		const schemaKeys = mentionIds.map(getSchemaKeyFromMentionId).filter((key): key is string => key !== null);
		const contextParts = [
			...mentionIds.filter(isTableMentionId).map((fqdn) => this._tableContext(fqdn)),
			...schemaKeys.map((schemaKey) => this._schemaContext(schemaKey)),
		].filter((part): part is string => part !== undefined);
		if (contextParts.length === 0) {
			return messages;
		}
		const dbContext = contextParts.join('\n\n');
		return this._transformLastUserMessageText(
			messages,
			(text) => `${text}\n\n---\nReferenced tables:\n${dbContext}`,
		);
	}

	private _tableContext(fqdn: string): string | undefined {
		const content = getTableColumnsContent(
			this._toolContext.clinicFolder,
			fqdn,
			this._toolContext.warehouseTableAccess,
		);
		return content ? `[Table: ${fqdn}]\n${content}` : undefined;
	}

	/** Only the first tables of a large schema come with their columns, the next ones are named, the rest counted. */
	private _schemaContext(schemaKey: string): string | undefined {
		const fqdns = listSchemaTableFqdns(
			this._toolContext.clinicFolder,
			schemaKey,
			this._toolContext.warehouseTableAccess,
		);
		if (fqdns.length === 0) {
			return undefined;
		}
		const detailedTables = fqdns.slice(0, MAX_SCHEMA_TABLES_WITH_COLUMNS).map((fqdn) => this._tableContext(fqdn));
		const otherTables = fqdns.slice(MAX_SCHEMA_TABLES_WITH_COLUMNS, MAX_SCHEMA_TABLES_NAMED);
		const unnamedCount = Math.max(fqdns.length - MAX_SCHEMA_TABLES_NAMED, 0);
		return [
			`[Schema: ${schemaKey}] ${fqdns.length} tables`,
			...detailedTables,
			otherTables.length > 0 ? `Other tables of ${schemaKey}: ${otherTables.join(', ')}` : undefined,
			unnamedCount > 0
				? `${unnamedCount} more tables of ${schemaKey} are not listed: search the context for them.`
				: undefined,
		]
			.filter((part): part is string => part !== undefined)
			.join('\n\n');
	}

	private _transformLastUserMessageText(messages: UIMessage[], transform: (text: string) => string): UIMessage[] {
		const [lastUserMessage, lastUserMessageIndex] = findLastUserMessage(messages);
		if (!lastUserMessage) {
			return messages;
		}
		const textPartIndex = lastUserMessage.parts.findIndex((part) => part.type === 'text');
		if (textPartIndex === -1) {
			return messages;
		}
		const textPart = lastUserMessage.parts[textPartIndex] as { type: 'text'; text: string };
		const updated = [...messages];
		const parts = [...lastUserMessage.parts];
		parts[textPartIndex] = { type: 'text', text: transform(textPart.text) };
		updated[lastUserMessageIndex] = { ...lastUserMessage, parts };
		return updated;
	}

	/** Anthropic cache breakpoints (direct, Vertex and Bedrock Claude). */
	private _addCache(messages: ModelMessage[]): ModelMessage[] {
		return addPromptCache(messages, this._modelSelection);
	}

	/** Drops old reasoning and follow-up suggestions from the conversation. */
	private _pruneMessages(messages: ModelMessage[]): ModelMessage[] {
		return pruneMessages({
			messages,
			reasoning: 'before-last-message',
			toolCalls: [{ tools: ['suggest_follow_ups'], type: 'all' }],
			emptyMessages: 'remove',
		});
	}
}

const IMAGE_URL_PATTERN = /^\/i\/([a-f0-9-]+)$/;

type MessageLike = Omit<UIMessage, 'id'>;
type ImageLoader = AgentManagerDependencies['getImageById'];

/**
 * Turns the attachments of a conversation into something a provider can consume.
 *
 * An image is inlined: its `/i/{id}` URL becomes the raw base64 payload. The AI SDK's
 * `convertToModelMessages` maps `FileUIPart.url` → `FilePart.data`, and a data-URL string
 * (data:…) would be misread as a link to download — the mediaType already travels in its
 * own field, so the bare base64 string is what the provider needs.
 *
 * A document in permanent storage is replaced by a line naming where it lives. Its bytes
 * stay out of the context window; the model reads the path when the question needs it.
 */
export async function resolveAttachments<T extends MessageLike>(
	messages: T[],
	getImageById: ImageLoader,
): Promise<T[]> {
	const imageData = await loadImageData(messages, getImageById);

	return messages.map((message) => ({
		...message,
		parts: message.parts.flatMap((part): UIMessagePart[] => {
			if (part.type !== 'file') {
				return [part];
			}

			const imageId = part.url.match(IMAGE_URL_PATTERN)?.[1];
			if (imageId) {
				const base64Data = imageData.get(imageId);
				return [base64Data ? { ...part, url: base64Data } : part];
			}

			if (isStoragePath(part.url)) {
				return [{ type: 'text' as const, text: describeStoredAttachment(part) }];
			}

			return [part];
		}),
	}));
}

async function loadImageData(messages: MessageLike[], getImageById: ImageLoader): Promise<Map<string, string>> {
	const imageIds = new Set<string>();
	for (const message of messages) {
		for (const part of message.parts) {
			const imageId = part.type === 'file' ? part.url.match(IMAGE_URL_PATTERN)?.[1] : undefined;
			if (imageId) {
				imageIds.add(imageId);
			}
		}
	}

	const imageData = new Map<string, string>();
	await Promise.all(
		[...imageIds].map(async (id) => {
			const image = await getImageById(id);
			if (image) {
				imageData.set(id, image.data);
			}
		}),
	);

	return imageData;
}

function describeStoredAttachment(part: { url: string; mediaType: string; filename?: string }): string {
	const name = part.filename ?? part.url.split('/').pop();
	const workbookHint =
		fileExtension(name ?? '') === 'xlsx'
			? ' Reading a workbook gives you its sheet names and the shape of each, which is what you need before querying one.'
			: '';

	return `[The user attached ${name} (${part.mediaType}) to this message. It is saved at ${part.url}. Its contents are not included here: read that path when you need them.${workbookHint}]`;
}

function describeCitation({ start, end, text }: CitationData): string {
	return `[The user is referring to the following text selection (chars ${start}–${end}):\n"${text}"]`;
}

function isTableMentionId(mentionId: string): boolean {
	return !isStoryReferenceMentionId(mentionId) && !isStoryFolderMentionId(mentionId) && !isSchemaMentionId(mentionId);
}
