import type { McpAccess, UserGroupFeature, WarehouseRowSecurity } from '@loopwise/shared';
import type { UserRulesGroupAccess } from '@loopwise/shared/rules-template';
import type {
	chartFacilityPanel,
	chartPatientTrend,
	createReport,
	describeAnalytics,
	displayChart,
	displayMap,
	executeSql,
	findPatient,
	getMetric,
	listAppointments,
	listLabOrders,
	listQueue,
	listResultsToReview,
	proposeEncounterNote,
	proposePatientRegistration,
	proposeScribeNote,
	report,
	runAnalyticsSql,
} from '@loopwise/shared/tools';
import type { LlmSelectedModel } from '@loopwise/shared/types';

import type { ChatImage } from '../../attachments/image.repository.js';
import type { SkillService } from '../../skills/skill.service.js';
import type { NewLlmInference } from '../../usage/llm-inference.repository.js';
import type { ProviderModelResult } from '../providers/providers.js';
import type { WarehouseTableAccess } from '../services/context-access.js';
import type {
	ResolvedDocsContextAccess,
	ResolvedFilesContextAccess,
	ResolvedSkillsAccess,
} from '../services/user-group-context-access.service.js';
import { AgentSettings } from './agent-settings.js';

export interface QueryResult {
	columns: string[];
	data: Record<string, unknown>[];
}

export interface GeneratedArtifacts {
	charts: (displayChart.BuiltinChartInput | displayChart.KpiCardInput)[];
	maps: displayMap.Input[];
}

/** A stored `execute_sql` part, read back as SQL (upstream `getExecuteSqlPartByQueryIdInChat`). */
export interface StoredQueryPart {
	toolCallId: string;
	/** `qt_<name>` for saved query tools. */
	toolName: 'execute_sql' | 'execute_semantic_query' | `qt_${string}`;
	toolInput: executeSql.Input;
	toolOutput: executeSql.Output;
	adminMode: boolean;
}

/**
 * loopwise: the services tools call, built per run by the agent module (PLAN.md §6: tools are framework-agnostic
 * AI SDK tools, services reach them through the ToolContext). Upstream imported these modules directly.
 */
export interface AgentToolServices {
	getQueryResultByQueryId(
		chatId: string,
		queryId: string,
	): Promise<{ columns: string[]; data: Record<string, unknown>[] } | null>;
	/** `utils/llm` `getClinicAvailableModels` (subagent model resolution). */
	getClinicAvailableModels(
		clinicId: string,
	): Promise<Array<{ provider: LlmSelectedModel['provider']; modelId: string; name: string }>>;
	/** `utils/llm` `resolveProviderModel` (subagent model resolution). */
	resolveProviderModel(
		clinicId: string,
		provider: LlmSelectedModel['provider'],
		modelId: string,
		applyUserSettings?: boolean,
	): Promise<ProviderModelResult | null>;
	/** `image.queries` `getImagesByChatId`: the images attached to the chat, copied into the sandbox. */
	getImagesByChatId(chatId: string): Promise<ChatImage[]>;
	/** Upstream's `skillService` singleton (`load_skill`); skills are initialized before the run. */
	skills: Pick<SkillService, 'getSkill' | 'getSkills' | 'getSkillBody'>;
	/** `scheduleSaveLlmInferenceRecord`: the usage of a model call outside the run's own messages (subagents). */
	recordLlmInference(record: NewLlmInference): void;
	/**
	 * `PatientService` reads for `propose_patient_registration`; registering itself is the user's mutation. Typed
	 * structurally so the frontend, which imports these types, never reaches the Nest models.
	 */
	patients: {
		/** The clinics where the user registers patients and records visits. */
		myCareClinics(userId: string): Promise<Array<proposePatientRegistration.Clinic & { organizationId: string }>>;
		isVisible(userId: string, patientId: string): Promise<boolean>;
		getChartSummary(userId: string, patientId: string): Promise<string | null>;
		/** `find_patient`: the search as the user, audited. */
		findForWise(
			userId: string,
			input: { query?: string; birthDate?: string },
			limit: number,
		): Promise<{ patients: WisePatient[]; truncated: boolean }>;
		/** `open_page`: the patient as the user (null when they may not see them), audited with `reason`. */
		getById(userId: string, patientId: string, reason?: string): Promise<PatientName | null>;
		checkDuplicates(
			userId: string,
			draft: Omit<proposePatientRegistration.Input, 'sex' | 'birthDate' | 'preferredLanguage'> & {
				clinicId: string;
				sex: NonNullable<proposePatientRegistration.Input['sex']>;
				birthDate: string;
				preferredLanguage?: string;
			},
		): Promise<proposePatientRegistration.Duplicate[]>;
	};
	/**
	 * `InsightsService` reads for the charts and reports (`chart_patient_trend`, `create_report`), as the user and
	 * audited. Typed structurally for the same reason as `patients`.
	 */
	insights: {
		/** Null when the user may not see the patient. */
		patientTrend(
			userId: string,
			patientId: string,
			measure: chartPatientTrend.PatientMeasure,
			months?: number,
		): Promise<chartPatientTrend.Output | null>;
		/** Counts across one of the user's clinics (their only one when `clinicId` is omitted). */
		facilityPanel(
			userId: string,
			metric: chartFacilityPanel.PanelMetric,
			clinicId?: string,
			months?: number,
		): Promise<chartFacilityPanel.Output>;
		buildReport(
			userId: string,
			spec: {
				type: createReport.ReportType;
				patientId?: string;
				encounterId?: string;
				/** For facility_panel: one of the user's clinics (the tool's `facilityId`). */
				facilityId?: string;
				months?: number;
				charts?: chartPatientTrend.PatientMeasure[];
				narrative: string;
				reportId: string;
			},
		): Promise<createReport.Snapshot>;
	};
	/**
	 * `AnalyticsService` (Wise analytics, DESIGN.md §7.2, §8.2): validated SQL and certified metrics on the analyst
	 * role, as the user, audited. Typed structurally for the same reason as `patients`.
	 */
	analytics: {
		describe(): Promise<Omit<describeAnalytics.Output, '_version'>>;
		run(
			userId: string,
			input: { sql: string; purpose: string; chart?: runAnalyticsSql.ResultChart },
			origin: { chatId: string; toolCallId: string; tool: string },
		): Promise<Omit<runAnalyticsSql.Output, '_version'>>;
		metric(
			userId: string,
			input: {
				metric: getMetric.Metric;
				months?: number;
				groupBy?: getMetric.Input['groupBy'];
				chart?: getMetric.Input['chart'];
			},
			origin: { chatId: string; toolCallId: string; tool: string },
		): Promise<Omit<getMetric.Output, '_version'>>;
	};
	/** `ReportsService` reads for the `report` tool: owner-only tool outputs of the chat and a report's versions. */
	reports: {
		toolOutputs(
			userId: string,
			chatId: string,
			toolCallIds: string[],
		): Promise<Record<string, { toolName: string; output: unknown }>>;
		versions(userId: string, chatId: string, reportId: string): Promise<report.Output[]>;
	};
	/** `AttachmentsService` read for `read_attachment`: a file in the user's own storage space, as text. */
	attachments: {
		readTextForWise(userId: string, clinicId: string, relativePath: string): Promise<string>;
	};
	/**
	 * `DiagnosticsWiseReader` reads, as the user and audited: the clinic's lab worklist (`list_lab_orders`, lab staff
	 * only) and the released results to review (`list_results_to_review`). Moving a test or reviewing a result is the
	 * user's own mutation, from the card.
	 */
	diagnostics: {
		labWorklistForWise(
			userId: string,
			clinicId: string,
			opts: { statuses: readonly listLabOrders.LabWorklistStatus[]; limit: number },
		): Promise<Omit<listLabOrders.Output, '_version'>>;
		resultsToReviewForWise(
			userId: string,
			opts: { patientId?: string; urgency?: listResultsToReview.Input['urgency']; limit: number },
		): Promise<Omit<listResultsToReview.Output, '_version'>>;
	};
	/**
	 * `ScribeWiseReader` read for `propose_scribe_note` (the AI scribe): checks the visit, the ICD-10 codes, the tests
	 * against the catalog and the allergies, as the user and audited. Each part is saved by its card's own mutation.
	 */
	scribe: {
		draftForWise(
			userId: string,
			patientId: string,
			input: proposeScribeNote.Input,
		): Promise<Omit<proposeScribeNote.Output, '_version' | 'success'>>;
	};
	/** `EncounterNoteService` read for `propose_encounter_note`; saving is the user's `updateEncounterNote`. */
	encounters: {
		getForWise(
			userId: string,
			patientId: string,
			encounterId?: string,
		): Promise<Omit<proposeEncounterNote.Output, '_version' | 'success'>>;
	};
	/**
	 * `SchedulingWiseReader` reads, as the user at the chat's clinic and audited: the day's appointments
	 * (`list_appointments`) and the queue (`list_queue`). Booking and moving appointments are the user's mutations, from
	 * the cards.
	 */
	scheduling: {
		appointmentsForWise(
			userId: string,
			clinicId: string | null,
			input: listAppointments.Input & { patientId?: string | null; limit: number },
		): Promise<Omit<listAppointments.Output, '_version'>>;
		queueForWise(
			userId: string,
			clinicId: string | null,
			input: listQueue.Input,
		): Promise<Omit<listQueue.Output, '_version'>>;
	};
}

interface PatientName {
	givenName: string;
	familyName: string;
}

/** A patient as `find_patient` returns them. */
interface WisePatient extends PatientName {
	id: string;
	patientNo: string;
	birthDate: string;
	sex: findPatient.Match['sex'];
	identifications: Array<{ label: string; idNumber: string }>;
}

export interface ToolContext {
	services: AgentToolServices;
	clinicFolder: string;
	chatId: string;
	userId: string;
	clinicId: string;
	/** The patient of a chart chat (`chat.patient_id`); undefined for other chats. */
	patientId?: string;
	supportsCustomCharts: boolean;
	agentSettings: AgentSettings | null;
	/** The model the run itself uses; subagents inherit it unless the clinic pins another one. */
	modelSelection?: LlmSelectedModel;
	usageRunId?: string;
	managedAiBillingMode?: 'wallet' | 'unbilled';
	envVars: Record<string, string>;
	warehouseTableAccess: WarehouseTableAccess;
	warehouseRowSecurity: WarehouseRowSecurity;
	docsContextAccess: ResolvedDocsContextAccess;
	filesContextAccess: ResolvedFilesContextAccess;
	/** MCP servers and tools the user's groups grant; spec files of other servers are hidden too. */
	mcpAccess: McpAccess;
	/** Clinic skills the user's groups grant; files of other skills under agent/skills/ are hidden too. */
	skillsAccess: ResolvedSkillsAccess;
	userGroupFeatures: UserGroupFeature[];
	userRulesGroupAccess: UserRulesGroupAccess;
	/** Clinic skills the user's groups load in full into the system prompt. */
	preloadedSkillNames?: string[];
	/**
	 * Database federation access token. Populated by the EE Microsoft/Azure AD
	 * integration when the user signs in via Microsoft; always null in the
	 * open-source edition.
	 */
	azureAccessToken: string | null;
	/**
	 * In-memory cache for query results within a single agent run.
	 * For queries from earlier turns in the same chat, prefer
	 * `services/query-result.service#getQueryResult`, which falls back
	 * to message history and caches the result back into this map.
	 */
	queryResults: Map<string, QueryResult>;
	generatedArtifacts: GeneratedArtifacts;
	/**
	 * Outputs of this run's tool calls by tool call id, for a `report` that embeds a result of the same turn (stored
	 * outputs of earlier turns come from `services.reports.toolOutputs`).
	 */
	toolOutputs?: Map<string, { toolName: string; output: unknown }>;
}

export type McpToolContext = Omit<ToolContext, 'chatId'> & {
	chatId: null;
};
