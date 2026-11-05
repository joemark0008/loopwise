import { isSkillGranted } from '@loopwise/shared';
import { documentMediaType, type ImageUploadData } from '@loopwise/shared/attachments';
import { markSupersededExecuteSqlParts } from '@loopwise/shared/execute-sql-parts';
import type { LlmProvider, LlmSelectedModel } from '@loopwise/shared/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { convertToModelMessages, type InferUIMessageChunk, type Tool } from 'ai';

import { ImageRepository } from '../attachments/image.repository.js';
import type { StorageScope } from '../attachments/storage/index.js';
import { statUserFile } from '../attachments/storage/user-files.js';
import { ChatRepository } from '../chats/chat.repository.js';
import { ANALYTICS_READER } from '../clinical/analytics/analytics-reader.token.js';
import { ENCOUNTER_NOTE_READER } from '../clinical/encounters/encounter-note-reader.token.js';
import { INSIGHTS_READER } from '../clinical/insights/insights-reader.token.js';
import { ORDERS_READER } from '../clinical/orders/orders-reader.token.js';
import { RULES_READER } from '../clinical/pathways/rules-reader.token.js';
import { PATIENT_READER } from '../clinical/patients/patient-reader.token.js';
import { REPORTS_READER } from '../clinical/reports/reports-reader.token.js';
import { RESULTS_READER } from '../clinical/results/results-reader.token.js';
import { ClinicRepository } from '../clinics/clinic.repository.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { ConfigService } from '../config/config.service.js';
import type { Clinic } from '../generated/prisma/client.js';
import { MemoryService } from '../memory/memory.service.js';
import { SkillService } from '../skills/skill.service.js';
import { LlmInferenceService } from '../usage/llm-inference.service.js';
import { WiseToolSettingsService } from '../wise-tools/wise-tool-settings.service.js';
import { type AgentChat, AgentManager, type AgentProfile } from './agent-manager.js';
import { ClinicLlmConfigRepository } from './llm/clinic-llm-config.repository.js';
import { LlmService } from './llm/llm.service.js';
import { renderToMarkdown } from './markdown/render-to-markdown.js';
import { ChatForkContextPrompt } from './prompts/chat-fork-context-prompt.js';
import { renderSystemPrompt } from './prompts/render-system-prompt.js';
import { getContextWindow } from './providers/providers.js';
import { listChartPlugins } from './services/chart-plugin.js';
import { CompactionService } from './services/compaction.js';
import { tokenCounter } from './services/token-counter.js';
import { readOnlyToolServices } from './services/tool-services.js';
import { fullClinicContextAccess } from './services/user-group-context-access.service.js';
import { getSystemPromptOverride, hasLoopwisePromptPlaceholder, injectLoopwisePrompt } from './system-prompts.js';
import { assertToolKinds, createWebSearchTools, getTools } from './tools/index.js';
import type { AgentSettings } from './types/agent-settings.js';
import type {
	AgentRequest,
	AgentRequestUserMessage,
	AgentTools,
	ContextUsage,
	UIMessage,
	UIMessagePart,
} from './types/chat.js';
import type { AgentToolServices, ToolContext } from './types/tools.js';
import { getUserRules } from './user-rules.js';
import { createChatTitle } from './utils/ai.js';
import { buildImageUrl } from './utils/image.js';
import { isStoragePath, toStorageRelativePath, toStorageVirtualPath } from './utils/tools.js';

/** The web chat's agent, Wise (upstream `agents/profiles/analytics.ts`). */
export const analyticsAgent: AgentProfile = { source: 'web' };

export interface AgentRequestResult {
	chatId: string;
	isNewChat: boolean;
	modelId: string;
	stream: ReadableStream<InferUIMessageChunk<UIMessage>>;
	agent: AgentManager;
}

/**
 * Port of upstream `services/agent.ts` (`AgentService`, `buildToolContext`), `services/agent-run.ts` and
 * `handlers/agent.ts`: authorizes a run, persists the user message, builds the tool context and starts the agent.
 * One running agent per chat; a new message on a chat stops the previous run.
 */
@Injectable()
export class AgentService {
	private readonly logger = new Logger(AgentService.name);
	private readonly agents = new Map<string, AgentManager>();

	constructor(
		private readonly chats: ChatRepository,
		private readonly clinics: ClinicRepository,
		private readonly llm: LlmService,
		private readonly llmConfigs: ClinicLlmConfigRepository,
		private readonly compaction: CompactionService,
		private readonly config: ConfigService,
		private readonly images: ImageRepository,
		private readonly skills: SkillService,
		private readonly memory: MemoryService,
		private readonly inferences: LlmInferenceService,
		@Inject(PATIENT_READER) private readonly patients: AgentToolServices['patients'],
		@Inject(INSIGHTS_READER) private readonly insights: AgentToolServices['insights'],
		@Inject(ANALYTICS_READER) private readonly analytics: AgentToolServices['analytics'],
		@Inject(REPORTS_READER) private readonly reports: AgentToolServices['reports'],
		@Inject(ENCOUNTER_NOTE_READER) private readonly encounterNotes: AgentToolServices['encounters'],
		@Inject(RESULTS_READER) private readonly results: AgentToolServices['results'],
		@Inject(ORDERS_READER) private readonly orders: AgentToolServices['orders'],
		private readonly toolSettings: WiseToolSettingsService,
		@Inject(RULES_READER) private readonly rules: AgentToolServices['rules'],
	) {}

	/** `POST /api/agent`: `authorizeAgentRun` + `handleAgentRoute`. */
	async handleAgentRequest(
		userId: string,
		currentClinic: Clinic | null,
		body: AgentRequest,
	): Promise<AgentRequestResult> {
		const clinicId = await this.resolveClinicId(currentClinic, body);
		if (body.mode !== 'default') {
			throw new HandlerError('FORBIDDEN', `Invalid ${body.mode} conversation`);
		}
		const userRole = await this.clinics.getUserRoleInClinic(clinicId, userId);
		if (!userRole || userRole === 'viewer') {
			throw new HandlerError('FORBIDDEN', 'Viewers cannot send messages');
		}
		const model = await this.resolveModelSelection(clinicId, body.model);

		const { chat, chatId, isNewChat, newMessageId } = await this.persistUserMessage(userId, clinicId, body);
		const agent = await this.create(
			{ id: chatId, clinicId, userId, forkMetadata: chat.forkMetadata },
			model,
			analyticsAgent,
		);
		const stream = agent.stream(chat.messages, {
			mentions: body.mentions,
			timezone: body.timezone,
			events: {
				newChat: isNewChat
					? {
							id: chatId,
							clinicId,
							title: chat.title,
							isStarred: chat.isStarred,
							createdAt: chat.createdAt,
							updatedAt: chat.updatedAt,
						}
					: undefined,
				newUserMessage: { newId: newMessageId },
			},
		});
		return { chatId, isNewChat, modelId: agent.getModelId(), stream, agent };
	}

	/** Creates the agent of a chat, stopping the chat's previous run. */
	async create(chat: AgentChat, modelSelection: LlmSelectedModel, profile: AgentProfile): Promise<AgentManager> {
		this.disposeAgent(chat.id);
		const modelConfig = await this.llm.resolveProviderModel(
			chat.clinicId,
			modelSelection.provider,
			modelSelection.modelId,
		);
		if (!modelConfig) {
			throw new HandlerError('BAD_REQUEST', 'The selected model could not be resolved.');
		}
		const [agentSettings, customBoundaries] = await Promise.all([
			this.llmConfigs.getAgentSettings(chat.clinicId) as Promise<AgentSettings | null>,
			this.clinics.getCustomBoundaries(chat.clinicId),
			this.safeInitializeSkills(chat.clinicId),
		]);
		const toolContext = await this.buildToolContext({
			clinicId: chat.clinicId,
			chatId: chat.id,
			userId: chat.userId,
			agentSettings,
			modelSelection,
		});
		const webTools = await this.resolveWebTools(chat.clinicId, modelSelection.provider, agentSettings);
		// The web profile's tool set (upstream `analyticsToolsExcluding([])`) unless the profile brings its own, less the
		// tools turned off in Wise settings (DESIGN.md §9.4): the model is never offered them, and the AI SDK refuses a
		// call to a tool outside this set. Computed per run, so a toggle applies from the next message.
		const offered = (
			profile.tools
				? profile.tools({ agentSettings })
				: getTools(agentSettings, { ...webTools }, { customBoundaries })
		) as AgentTools;
		const disabledTools = await this.toolSettings.disabledToolNames(chat.userId, Object.keys(offered));
		const tools = Object.fromEntries(
			Object.entries(offered).filter(([name]) => !disabledTools.includes(name)),
		) as AgentTools;
		assertToolKinds(tools);
		const agent = new AgentManager(
			chat,
			profile,
			modelConfig,
			modelSelection,
			() => this.agents.delete(chat.id),
			new AbortController(),
			tools,
			toolContext,
			{
				chats: this.chats,
				llm: this.llm,
				compaction: this.compaction,
				inferences: this.inferences,
				getImageById: (id) => this.images.getImageById(id),
				buildSystemPrompt: async ({ toolNames, timezone }) => {
					if (profile.systemPrompt) {
						return profile.systemPrompt({ timezone });
					}
					return this.buildClinicSystemPrompt(
						toolContext,
						toolNames,
						timezone,
						chat.forkMetadata,
						disabledTools,
					);
				},
				getSkillContent: (skillName) => this.skills.getSkillContent(chat.clinicId, skillName),
				// A chart chat is about one patient: memories apply to every chat, so none are taken from it.
				scheduleMemoryExtraction: toolContext.patientId
					? undefined
					: ({ messages, provider, modelId }) =>
							this.memory.safeScheduleMemoryExtraction({
								userId: chat.userId,
								clinicId: chat.clinicId,
								chatId: chat.id,
								messages,
								provider,
								modelId,
							}),
			},
		);
		this.agents.set(chat.id, agent);
		return agent;
	}

	get(chatId: string): AgentManager | undefined {
		return this.agents.get(chatId);
	}

	/** Stops the running agent of a chat (the Stop button). Returns whether one was running. */
	stop(chatId: string, userId: string): boolean {
		const agent = this.agents.get(chatId);
		if (!agent) {
			return false;
		}
		if (!agent.checkIsUserOwner(userId)) {
			throw new HandlerError('FORBIDDEN', 'You can only stop your own chats.');
		}
		agent.stop();
		return true;
	}

	/**
	 * Port of upstream `utils/chat-context-usage.ts`: tokens the chat's next turn would send (system prompt,
	 * messages, tools). Memories, chat artifacts and compaction aren't ported yet, so they don't count.
	 */
	async getChatContextUsage(opts: {
		chatId: string;
		model?: { provider: LlmProvider; modelId: string };
	}): Promise<ContextUsage | null> {
		const clinicId = await this.chats.getChatClinicId(opts.chatId);
		if (!clinicId) {
			return null;
		}
		const agentSettings = (await this.llmConfigs.getAgentSettings(clinicId)) as AgentSettings | null;
		const tools = getTools(agentSettings) as Record<string, Tool>;
		const uiMessages = markSupersededExecuteSqlParts(await this.chats.getChatMessages(opts.chatId));
		const systemMessage: Omit<UIMessage, 'id'> = {
			role: 'system',
			parts: [{ type: 'text', text: renderSystemPrompt({}) }],
		};
		const messages = await convertToModelMessages<UIMessage>([systemMessage, ...uiMessages], { tools });
		const messageTokens = tokenCounter.estimateMessages(messages);
		const toolTokens = await tokenCounter.estimateTools(tools as AgentTools);
		return {
			tokensUsed: messageTokens + toolTokens,
			contextWindow: opts.model ? getContextWindow(opts.model.provider, opts.model.modelId) : null,
		};
	}

	/** Upstream `_resolveWebTools`: the provider's web search (and fetch) tools when the clinic enables them. */
	private async resolveWebTools(
		clinicId: string,
		provider: LlmProvider,
		agentSettings: AgentSettings | null,
	): Promise<Record<string, unknown> | null> {
		if (!agentSettings?.webSearch?.enabled) {
			return null;
		}
		const settings = await this.llm.resolveProviderSettings(clinicId, provider);
		if (!settings) {
			return null;
		}
		return createWebSearchTools(provider, settings);
	}

	/** The chat's model, else the clinic default (upstream `_getResolvedLlmSelectedModel`). */
	async resolveModelSelection(clinicId: string, modelSelection?: LlmSelectedModel): Promise<LlmSelectedModel> {
		if (modelSelection) {
			return modelSelection;
		}
		const defaultModel = await this.llm.resolveDefaultChatModel(clinicId);
		if (defaultModel) {
			return defaultModel;
		}
		throw new HandlerError('BAD_REQUEST', 'No model config found');
	}

	/** The tool context of a chat outside a run, with the clinic's agent settings. */
	async buildChatToolContext(opts: { clinicId: string; userId: string; chatId: string }): Promise<ToolContext> {
		const agentSettings = (await this.llmConfigs.getAgentSettings(opts.clinicId)) as AgentSettings | null;
		return this.buildToolContext({ ...opts, agentSettings });
	}

	/** Upstream `buildToolContext`. */
	async buildToolContext(opts: {
		clinicId: string;
		userId: string;
		chatId: string;
		agentSettings: AgentSettings | null;
		modelSelection?: LlmSelectedModel;
	}): Promise<ToolContext> {
		const clinic = await this.clinics.getClinicById(opts.clinicId);
		if (!clinic?.path) {
			throw new HandlerError('BAD_REQUEST', 'Clinic path does not exist.');
		}
		const access = fullClinicContextAccess();
		const patientId = (await this.chats.getChatPatient(opts.chatId))?.patientId ?? undefined;
		return {
			services: {
				getQueryResultByQueryId: (chatId, queryId) => this.chats.getQueryResultByQueryId(chatId, queryId),
				getClinicAvailableModels: (clinicId) => this.llm.getClinicAvailableModels(clinicId),
				resolveProviderModel: (clinicId, provider, modelId, applyUserSettings) =>
					this.llm.resolveProviderModel(clinicId, provider, modelId, applyUserSettings),
				getImagesByChatId: (chatId) => this.images.getImagesByChatId(chatId),
				recordLlmInference: (record) => this.inferences.scheduleSave(record),
				// Read methods only, never the services: a tool can't reach a write even at runtime (DESIGN.md §9.1).
				...readOnlyToolServices({
					patients: this.patients,
					skills: this.skills,
					encounters: this.encounterNotes,
					insights: this.insights,
					analytics: this.analytics,
					reports: this.reports,
					results: this.results,
					orders: this.orders,
					rules: this.rules,
				}),
			},
			clinicFolder: clinic.path,
			chatId: opts.chatId,
			userId: opts.userId,
			clinicId: opts.clinicId,
			...(patientId && { patientId }),
			supportsCustomCharts: true,
			agentSettings: opts.agentSettings,
			...(opts.modelSelection && { modelSelection: opts.modelSelection }),
			envVars: {},
			warehouseTableAccess: access.warehouseTableAccess,
			warehouseRowSecurity: access.warehouseRowSecurity,
			docsContextAccess: access.docsContextAccess,
			filesContextAccess: access.filesContextAccess,
			mcpAccess: access.mcpAccess,
			skillsAccess: access.skillsAccess,
			userGroupFeatures: access.userGroupFeatures,
			userRulesGroupAccess: access.userRulesGroupAccess,
			preloadedSkillNames: access.preloadedSkillNames,
			azureAccessToken: null,
			queryResults: new Map(),
			generatedArtifacts: { charts: [], maps: [] },
			toolOutputs: new Map(),
		};
	}

	/** `_buildClinicSystemPrompt`: the clinic's prompt override, or loopwise's prompt (with `{{loopwise}}` injection). */
	private async buildClinicSystemPrompt(
		toolContext: ToolContext,
		toolNames: string[],
		timezone?: string,
		forkMetadata?: AgentChat['forkMetadata'],
		disabledTools: string[] = [],
	): Promise<string> {
		const prompt = await this.buildBaseSystemPrompt(toolContext, toolNames, timezone, disabledTools);
		return forkMetadata ? renderToMarkdown(ChatForkContextPrompt({ basePrompt: prompt, forkMetadata })) : prompt;
	}

	private async buildBaseSystemPrompt(
		toolContext: ToolContext,
		toolNames: string[],
		timezone?: string,
		disabledTools: string[] = [],
	): Promise<string> {
		const override = getSystemPromptOverride(toolContext.clinicFolder);
		if (override && !hasLoopwisePromptPlaceholder(override)) {
			return override;
		}
		const memories = await this.memory.safeGetUserMemories(
			toolContext.userId,
			toolContext.clinicId,
			toolContext.chatId,
		);
		const skills = this.skills
			.getSkills(toolContext.clinicId)
			.filter((skill) => isSkillGranted(toolContext.skillsAccess, skill.name));
		const preloadedSkills = this.skills.getPreloadedSkills(toolContext.clinicId, toolContext.preloadedSkillNames);
		const currentPatient = toolContext.patientId
			? await this.patients.getChartSummary(toolContext.userId, toolContext.patientId)
			: null;
		const defaultPrompt = renderSystemPrompt({
			...(currentPatient && { currentPatient }),
			memories,
			skills,
			preloadedSkills,
			userRules: getUserRules(toolContext.clinicFolder, toolContext.userRulesGroupAccess),
			customCharts: toolContext.supportsCustomCharts ? listChartPlugins(toolContext.clinicFolder) : [],
			timezone,
			toolNames,
			disabledTools,
		});
		return override ? injectLoopwisePrompt(override, defaultPrompt) : defaultPrompt;
	}

	/** A chart chat needs a patient the user may see, and there is one per clinician per patient. */
	private async requireNewPatientChat(userId: string, patientId: string): Promise<void> {
		if (!(await this.patients.isVisible(userId, patientId))) {
			throw new HandlerError('FORBIDDEN', 'This patient is not in your care.');
		}
		if (await this.chats.getPatientChatId(userId, patientId)) {
			throw new HandlerError('CONFLICT', 'You already have a chat about this patient; continue that one.');
		}
	}

	/** Upstream `safeInitializeSkills`: a broken skills folder must not block the run. */
	private async safeInitializeSkills(clinicId: string): Promise<void> {
		try {
			await this.skills.initializeSkills(clinicId);
		} catch (error) {
			this.logger.warn(`Failed to initialize skills for clinic ${clinicId}: ${String(error)}`);
		}
	}

	private async resolveClinicId(currentClinic: Clinic | null, body: AgentRequest): Promise<string> {
		if (body.chatId) {
			const chatClinicId = await this.chats.getChatClinicId(body.chatId);
			if (!chatClinicId) {
				throw new HandlerError('NOT_FOUND', `Chat with id ${body.chatId} not found.`);
			}
			return chatClinicId;
		}
		if (currentClinic) {
			return currentClinic.id;
		}
		throw new HandlerError('BAD_REQUEST', 'No clinic configured: create a clinic first.');
	}

	/** `persistUserMessage`: a new chat, or a message appended to (or replacing one of) an existing chat. */
	private async persistUserMessage(userId: string, clinicId: string, body: AgentRequest) {
		const { message, messageToEditId } = body;
		const scope: StorageScope = { clinicId, userId };
		const source = analyticsAgent.source;
		let chatId = body.chatId;
		let newMessageId: string;
		const isNewChat = !chatId;
		if (!chatId) {
			if (body.patientId) {
				await this.requireNewPatientChat(userId, body.patientId);
			}
			const attachmentParts = await this.buildAttachmentParts(message, scope);
			const [chat, firstMessage] = await this.chats.createChat(
				{
					title: createChatTitle(message),
					userId,
					clinicId,
					...(body.patientId && { patientId: body.patientId, surface: 'patient' }),
				},
				{ text: message.text, citation: message.citation, source },
				attachmentParts,
			);
			chatId = chat.id;
			newMessageId = firstMessage.id;
		} else {
			const ownerId = await this.chats.getChatOwnerId(chatId);
			if (!ownerId) {
				throw new HandlerError('NOT_FOUND', `Chat with id ${chatId} not found.`);
			}
			if (ownerId !== userId) {
				throw new HandlerError('FORBIDDEN', 'You are not authorized to access this chat.');
			}
			const attachmentParts = await this.buildAttachmentParts(message, scope);
			let versionGroupId: string | undefined;
			if (messageToEditId) {
				versionGroupId = await this.chats.resolveVersionGroupIdForEdit(chatId, messageToEditId);
				await this.chats.supersedeMessagesFrom(chatId, messageToEditId);
			}
			const saved = await this.chats.upsertMessage({
				role: 'user',
				parts: [{ type: 'text', text: message.text }, ...attachmentParts],
				chatId,
				senderUserId: userId,
				source,
				citation: message.citation,
				versionGroupId,
			});
			newMessageId = saved.messageId;
		}

		const [chat] = await this.chats.getChat(chatId);
		if (!chat) {
			throw new HandlerError('NOT_FOUND', `Chat with id ${chatId} not found.`);
		}
		return { chat, chatId, isNewChat, newMessageId };
	}

	/**
	 * Both kinds of attachment become a `file` part, but they get there differently: an image is stored in the
	 * database so it can be inlined for the model, while a document was already uploaded to permanent storage
	 * (`POST /api/attachments`) and is only referenced by its path.
	 */
	private async buildAttachmentParts(
		message: AgentRequestUserMessage,
		scope: StorageScope,
	): Promise<UIMessagePart[]> {
		const [imageParts, documentParts] = await Promise.all([
			this.buildImageParts(message.images),
			this.buildDocumentParts(message.documents, scope),
		]);
		return [...imageParts, ...documentParts];
	}

	private async buildImageParts(images: ImageUploadData[] | undefined): Promise<UIMessagePart[]> {
		if (!images?.length) {
			return [];
		}
		const savedImages = await this.images.saveImages(images);
		return savedImages.map(({ id, mediaType }) => ({ type: 'file' as const, mediaType, url: buildImageUrl(id) }));
	}

	private async buildDocumentParts(
		virtualPaths: string[] | undefined,
		scope: StorageScope,
	): Promise<UIMessagePart[]> {
		if (!virtualPaths?.length) {
			return [];
		}
		return Promise.all(virtualPaths.map((virtualPath) => this.buildDocumentPart(virtualPath, scope)));
	}

	private async buildDocumentPart(virtualPath: string, scope: StorageScope): Promise<UIMessagePart> {
		let relativePath = '';
		try {
			relativePath = isStoragePath(virtualPath) ? toStorageRelativePath(virtualPath) : '';
		} catch {
			throw new HandlerError('BAD_REQUEST', `Invalid attached file path: ${virtualPath}`);
		}
		const stored = relativePath ? await statUserFile(scope, relativePath) : null;
		if (!stored) {
			throw new HandlerError('BAD_REQUEST', `Attached file not found: ${virtualPath}`);
		}

		const filename = relativePath.split('/').pop()!;
		return {
			type: 'file' as const,
			mediaType: documentMediaType(filename) ?? 'application/octet-stream',
			filename,
			url: toStorageVirtualPath(relativePath),
		};
	}

	private disposeAgent(chatId: string): void {
		const agent = this.agents.get(chatId);
		if (agent) {
			this.logger.debug(`Stopping the previous run of chat ${chatId}`);
			agent.stop();
			this.agents.delete(chatId);
		}
	}
}
