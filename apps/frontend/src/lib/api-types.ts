/**
 * Inputs and outputs of the apps/api procedures the frontend calls, in the shape upstream's tRPC router had
 * (`inferRouterInputs` / `inferRouterOutputs`), so call sites read `ApiInputs['chat']['get']` as they read the
 * router's types before the cut-over (Phase 8).
 *
 * The procedures are GraphQL fields whose `JSON` results the `lib/*-api.ts` modules cast; their types were
 *   generated once from upstream's router at the cut-over and point at loopwise's own type modules. Keep them in step
 *   with apps/api by hand.
 */
import type { AgentSettings } from '@loopwise/api/agent/types/agent-settings';
import type { ForkMetadata, UIChat } from '@loopwise/api/agent/types/chat';
import type { StorageConfigSummary } from '@loopwise/api/attachments/storage/index';
import type { StorageUsage } from '@loopwise/api/attachments/storage/usage';
import type { SearchChatResult } from '@loopwise/api/chats/chat.repository';
import type { QueryRowsPage } from '@loopwise/api/chats/query-rows.service';
import type { SharedChatWithDetails } from '@loopwise/api/chats/shared-chat.repository';
import type { ModelSettingsService } from '@loopwise/api/model-settings/model-settings.service';
import type { Skill, SkillLoadError } from '@loopwise/api/skills/skill.service';
import type { DefaultModelSettings } from '@loopwise/shared/background-models';
import type { ChartPluginManifestEntry } from '@loopwise/shared/chart-plugin';
import type { ColumnLineageNode } from '@loopwise/shared/citation';
import type { DisplaySettings } from '@loopwise/shared/date';
import type { CustomBoundarySet } from '@loopwise/shared/map';
import type { displayChart, displayMap } from '@loopwise/shared/tools';
import type { GroupedChatListResponse, LlmProvider, LlmSelectedModel, UserRole } from '@loopwise/shared/types';
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import type {
	AddAllergyInput,
	AddDiagnosisInput,
	CreateEncounterInput,
	EncounterFieldsFragment,
	AllergyFieldsFragment,
	EncounterRecordFieldsFragment,
	MedicalCertificatePrintQuery,
	MyPractitionerQuery,
	SaveMyPractitionerInput,
	ClinicEncountersInput,
	TransitionEncounterInput,
	BarangaysQuery,
	PatientOverviewFieldsFragment,
	PrescriptionPrintQuery,
	RecordVitalsInput,
	SaveMedicalCertificateInput,
	SavePrescriptionInput,
	SearchIcd10Query,
	UpdateDiagnosisInput,
	UpdateEncounterNoteInput,
	VoidAllergyInput,
	VoidEntryInput,
	LinkExistingPatientInput,
	MyCareClinicsQuery,
	PatientDraftInput,
	PatientDuplicateFieldsFragment,
	PatientFieldsFragment,
	RegisterPatientInput,
	SearchPatientsInput,
	WiseOriginInput,
	WiseProposalOutcomeFieldsFragment,
	EncounterBillingFieldsFragment,
	IssueInvoiceInput,
	RecordPaymentInput,
	SaveInvoiceDraftInput,
	VoidInvoiceInput,
	CancelDiagnosticOrderInput,
	CreateDiagnosticOrderInput,
	DiagnosticItemStepInput,
	DiagnosticOrderFieldsFragment,
	DiagnosticOrderStatus,
	DiagnosticReportFieldsFragment,
	DiagnosticTestFieldsFragment,
	EnterDiagnosticResultInput,
	LabWorklistCountsQuery,
	LabWorklistItemFieldsFragment,
	MarkSpecimenCollectedInput,
	ReviewResultInput,
} from '@/graphql/generated/graphql';

interface Procedure<Input, Output> {
	input: Input;
	output: Output;
}

export type SavedPrompt = { id: string; createdAt: Date; updatedAt: Date; prompt: string; title: string };

interface GraphQLProcedures {
	chart: {
		download: Procedure<{ toolCallId: string }, string>;
		updateConfig: Procedure<{ toolCallId: string; config: displayChart.Input }, { success: true }>;
	};
	chartPlugin: {
		list: Procedure<void, ChartPluginManifestEntry[]>;
		source: Procedure<{ type: string; version: string }, { source: string; version: string }>;
	};
	chat: {
		cancel: Procedure<{ chatId: string }, { outcome: 'deleted' | 'kept'; chatDeleted: boolean }>;
		delete: Procedure<{ chatId: string }, void>;
		deleteAllNonStarred: Procedure<void, { count: number }>;
		get: Procedure<{ chatId: string }, UIChat>;
		getContextUsage: Procedure<
			{ chatId: string; model?: { provider: LlmProvider; modelId: string } | undefined },
			{ tokensUsed: number; contextWindow: number | null }
		>;
		getForkMetadata: Procedure<{ chatId: string }, ForkMetadata | null>;
		getQueryRows: Procedure<
			{
				chatId: string;
				toolCallId: string;
				queryId: string;
				offset?: number | undefined;
				limit?: number | undefined;
				sort?: { column: string; direction: 'asc' | 'desc' } | undefined;
			},
			QueryRowsPage
		>;
		listGrouped: Procedure<
			{
				groupBy?: 'date' | 'none' | 'clinic' | 'star' | 'ownership' | 'sourcePlatform' | undefined;
				filters?: ('all' | 'mine' | 'starred' | 'shared' | 'shared_with_me')[] | undefined;
			},
			GroupedChatListResponse
		>;
		rename: Procedure<{ chatId: string; title: string }, void>;
		search: Procedure<{ query: string; limit?: number | undefined }, SearchChatResult[]>;
		stop: Procedure<{ chatId: string }, void>;
		switchMessageVersion: Procedure<{ chatId: string; messageId: string }, void>;
		toggleStarred: Procedure<{ chatId: string; isStarred: boolean }, void>;
	};
	chatFork: {
		askSharedChat: Procedure<
			{ shareId: string; selection?: { start: number; end: number; text: string } | undefined },
			{ chatId: string }
		>;
		fork: Procedure<
			{
				source: { type: 'chat'; shareId: string };
				selection?: { start: number; end: number; text: string } | undefined;
			},
			{ chatId: string }
		>;
		listSharedChatQuickQuestions: Procedure<
			{ shareId: string },
			{ chatId: string; title: string; updatedAt: Date }[]
		>;
	};
	citation: {
		get: Procedure<
			{ queryId: string; column: string },
			{ sql_query: string; database_id: string; tables: { name: string }[]; column_lineage: ColumnLineageNode }
		>;
	};
	feedback: {
		submit: Procedure<
			{ chatId: string; messageId: string; vote: 'up' | 'down'; explanation?: string | undefined },
			{ createdAt: Date; updatedAt: Date; messageId: string; vote: 'up' | 'down'; explanation: string | null }
		>;
	};
	map: {
		updateConfig: Procedure<{ mapId: string; config: displayMap.Input }, { success: true }>;
	};
	memory: {
		delete: Procedure<{ memoryId: string }, void>;
		edit: Procedure<
			{ memoryId: string; content: string },
			{
				id: string;
				createdAt: Date;
				updatedAt: Date;
				userId: string;
				chatId: string | null;
				category: 'global_rule' | 'personal_fact';
				content: string;
				supersededBy: string | null;
			}
		>;
		setEnabled: Procedure<{ memoryEnabled: boolean }, { memoryEnabled: boolean }>;
	};
	clinic: {
		addMapBoundary: Procedure<
			{
				key: string;
				label: string;
				url: string;
				joinProperty: string;
				regionKeyHint: string;
				featureCount?: number | undefined;
			},
			CustomBoundarySet[]
		>;
		createSavedPrompt: Procedure<
			{ title: string; prompt: string },
			{ id: string; createdAt: Date; updatedAt: Date; prompt: string; title: string; clinicId: string }
		>;
		deleteLlmConfig: Procedure<{ provider: LlmProvider }, { success: boolean }>;
		deleteMapBoundary: Procedure<{ key: string }, CustomBoundarySet[]>;
		deleteSavedPrompt: Procedure<{ promptId: string }, void>;
		getAgentSettings: Procedure<
			void,
			{
				capabilities: { pythonSandbox: boolean; sandbox: boolean; semanticLayer: boolean };
				memoryEnabled?: boolean | undefined;
				mapEnabled?: boolean | undefined;
				experimental?: { pythonSandboxing?: boolean | undefined; sandboxes?: boolean | undefined } | undefined;
				transcribe?:
					| { enabled?: boolean | undefined; provider?: string | undefined; modelId?: string | undefined }
					| undefined;
				sql?:
					| {
							dangerouslyWritePermEnabled?: boolean | undefined;
							enforceExcludedColumns?: boolean | undefined;
					  }
					| undefined;
				pythonExecution?: { maxDurationSecs?: number | undefined } | undefined;
				webSearch?: { enabled?: boolean | undefined; mode?: 'provider' | undefined } | undefined;
				semanticLayer?: { mode?: 'disabled' | 'exclusive' | 'prioritized' | undefined } | undefined;
				subagent?: { model?: LlmSelectedModel | null | undefined } | undefined;
			} | null
		>;
		getDatabaseObjects: Procedure<
			void,
			{ type: string; database: string; schema: string; table: string; fqdn: string }[]
		>;
		getDefaultChatModel: Procedure<void, LlmSelectedModel | null>;
		getDefaultModels: Procedure<void, Awaited<ReturnType<ModelSettingsService['getDefaultModels']>>>;
		getDisplaySettings: Procedure<void, DisplaySettings>;
		getKnownModels: Procedure<void, ReturnType<ModelSettingsService['getKnownModels']>>;
		getKnownTranscribeModels: Procedure<
			void,
			{
				[x: string]: {
					models: {
						id: string;
						name: string;
						default?: boolean | undefined;
						pricePerMinute?: number | undefined;
					}[];
					hasKey: boolean;
				};
			}
		>;
		getLlmConfigs: Procedure<
			void,
			{
				clinicConfigs: {
					id: string;
					provider: LlmProvider;
					apiKeyPreview: string | null;
					credentialPreviews: Record<string, string> | null;
					enabledModels: string[] | null;
					customModels: {
						id: string;
						displayName?: string | undefined;
						costPerM?:
							| {
									inputNoCache?: number | undefined;
									inputCacheRead?: number | undefined;
									inputCacheWrite?: number | undefined;
									output?: number | undefined;
							  }
							| undefined;
					}[];
					modelSettings: Record<
						string,
						{
							temperature?: number | undefined;
							topP?: number | undefined;
							topK?: number | undefined;
							maxOutputTokens?: number | undefined;
							reasoningEffort?: 'max' | 'off' | 'minimal' | 'low' | 'medium' | 'high' | undefined;
							thinkingBudgetTokens?: number | undefined;
							thinkingDisplay?: 'omitted' | 'updates' | 'summarized' | undefined;
							textVerbosity?: 'low' | 'medium' | 'high' | undefined;
							reasoningSummary?: 'auto' | 'detailed' | undefined;
							parallelToolCalls?: boolean | undefined;
							maxToolCalls?: number | undefined;
							serviceTier?:
								'default' | 'auto' | 'standard' | 'flex' | 'priority' | 'reserved' | undefined;
							speed?: 'standard' | 'fast' | undefined;
							inferenceGeo?: 'us' | 'global' | undefined;
							sendReasoning?: boolean | undefined;
							includeThoughts?: boolean | undefined;
							safetyThreshold?:
								| 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'
								| 'BLOCK_LOW_AND_ABOVE'
								| 'BLOCK_MEDIUM_AND_ABOVE'
								| 'BLOCK_ONLY_HIGH'
								| 'BLOCK_NONE'
								| 'OFF'
								| undefined;
							mediaResolution?:
								| 'MEDIA_RESOLUTION_UNSPECIFIED'
								| 'MEDIA_RESOLUTION_LOW'
								| 'MEDIA_RESOLUTION_MEDIUM'
								| 'MEDIA_RESOLUTION_HIGH'
								| undefined;
							safePrompt?: boolean | undefined;
							documentImageLimit?: number | undefined;
							documentPageLimit?: number | undefined;
						}
					>;
					baseUrl: string | null;
					createdAt: Date;
					updatedAt: Date;
				}[];
				configProviders: {
					provider: LlmProvider;
					apiKeyPreview: string | null;
					credentialPreviews: Record<string, string> | null;
					enabledModels: string[];
					customModels: {
						id: string;
						displayName?: string | undefined;
						costPerM?:
							| {
									inputNoCache?: number | undefined;
									inputCacheRead?: number | undefined;
									inputCacheWrite?: number | undefined;
									output?: number | undefined;
							  }
							| undefined;
					}[];
					modelSettings: Record<
						string,
						{
							temperature?: number | undefined;
							topP?: number | undefined;
							topK?: number | undefined;
							maxOutputTokens?: number | undefined;
							reasoningEffort?: 'max' | 'off' | 'minimal' | 'low' | 'medium' | 'high' | undefined;
							thinkingBudgetTokens?: number | undefined;
							thinkingDisplay?: 'omitted' | 'updates' | 'summarized' | undefined;
							textVerbosity?: 'low' | 'medium' | 'high' | undefined;
							reasoningSummary?: 'auto' | 'detailed' | undefined;
							parallelToolCalls?: boolean | undefined;
							maxToolCalls?: number | undefined;
							serviceTier?:
								'default' | 'auto' | 'standard' | 'flex' | 'priority' | 'reserved' | undefined;
							speed?: 'standard' | 'fast' | undefined;
							inferenceGeo?: 'us' | 'global' | undefined;
							sendReasoning?: boolean | undefined;
							includeThoughts?: boolean | undefined;
							safetyThreshold?:
								| 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'
								| 'BLOCK_LOW_AND_ABOVE'
								| 'BLOCK_MEDIUM_AND_ABOVE'
								| 'BLOCK_ONLY_HIGH'
								| 'BLOCK_NONE'
								| 'OFF'
								| undefined;
							mediaResolution?:
								| 'MEDIA_RESOLUTION_UNSPECIFIED'
								| 'MEDIA_RESOLUTION_LOW'
								| 'MEDIA_RESOLUTION_MEDIUM'
								| 'MEDIA_RESOLUTION_HIGH'
								| undefined;
							safePrompt?: boolean | undefined;
							documentImageLimit?: number | undefined;
							documentPageLimit?: number | undefined;
						}
					>;
					baseUrl: string | null;
				}[];
				envProviders: LlmProvider[];
				envBaseUrls: Record<string, string>;
			}
		>;
		getMapBoundaries: Procedure<void, CustomBoundarySet[]>;
		getMemorySettings: Procedure<void, { memoryEnabled: boolean }>;
		getClinicSavedPrompts: Procedure<{ clinicId: string }, SavedPrompt[]>;
		getSavedPrompts: Procedure<void, SavedPrompt[]>;
		listAvailableTranscribeModels: Procedure<
			void,
			{ provider: LlmProvider; modelId: string; name: string; baseUrl: string | null }[]
		>;
		updateAgentSettings: Procedure<
			{
				experimental?: { pythonSandboxing?: boolean | undefined; sandboxes?: boolean | undefined } | undefined;
				mapEnabled?: boolean | undefined;
				transcribe?:
					| { enabled?: boolean | undefined; provider?: string | undefined; modelId?: string | undefined }
					| undefined;
				sql?:
					| {
							dangerouslyWritePermEnabled?: boolean | undefined;
							enforceExcludedColumns?: boolean | undefined;
					  }
					| undefined;
				pythonExecution?: { maxDurationSecs?: number | undefined } | undefined;
				memoryEnabled?: boolean | undefined;
				webSearch?: { enabled?: boolean | undefined; mode?: 'provider' | undefined } | undefined;
				semanticLayer?: { mode?: 'disabled' | 'exclusive' | 'prioritized' | undefined } | undefined;
				subagent?: { model?: { provider: LlmProvider; modelId: string } | null | undefined } | undefined;
			},
			AgentSettings
		>;
		updateDefaultModels: Procedure<
			{
				mode: 'single' | 'perCategory';
				chat?: { provider: LlmProvider; modelId: string } | undefined;
				single?: { provider: LlmProvider; modelId: string } | undefined;
				categories?:
					| {
							title?: { provider: LlmProvider; modelId: string } | undefined;
							other?: { provider: LlmProvider; modelId: string } | undefined;
							context_recommendation?: { provider: LlmProvider; modelId: string } | undefined;
							compaction?: { provider: LlmProvider; modelId: string } | undefined;
							live_story?: { provider: LlmProvider; modelId: string } | undefined;
					  }
					| undefined;
			},
			DefaultModelSettings
		>;
		updateDisplaySettings: Procedure<
			{
				dateFormat?:
					| { preset: 'custom' | 'european' | 'american' | 'iso'; customFormat?: string | undefined }
					| undefined;
			},
			DisplaySettings
		>;
		updateMapBoundary: Procedure<
			{
				key: string;
				newKey?: string | undefined;
				label?: string | undefined;
				url?: string | undefined;
				joinProperty?: string | undefined;
				regionKeyHint?: string | undefined;
				featureCount?: number | undefined;
			},
			CustomBoundarySet[]
		>;
		updateSavedPrompt: Procedure<
			{ id: string; title?: string | undefined; prompt?: string | undefined },
			{ id: string; createdAt: Date; updatedAt: Date; prompt: string; title: string; clinicId: string }
		>;
		upsertLlmConfig: Procedure<
			{
				provider: LlmProvider;
				apiKey?: string | undefined;
				credentials?: Record<string, string> | undefined;
				enabledModels?: string[] | undefined;
				customModels?:
					| {
							id: string;
							displayName?: string | undefined;
							costPerM?:
								| {
										inputNoCache?: number | undefined;
										inputCacheRead?: number | undefined;
										inputCacheWrite?: number | undefined;
										output?: number | undefined;
								  }
								| undefined;
					  }[]
					| undefined;
				modelSettings?:
					| Record<
							string,
							{
								temperature?: number | undefined;
								topP?: number | undefined;
								topK?: number | undefined;
								maxOutputTokens?: number | undefined;
								reasoningEffort?: 'max' | 'off' | 'minimal' | 'low' | 'medium' | 'high' | undefined;
								thinkingBudgetTokens?: number | undefined;
								thinkingDisplay?: 'omitted' | 'updates' | 'summarized' | undefined;
								textVerbosity?: 'low' | 'medium' | 'high' | undefined;
								reasoningSummary?: 'auto' | 'detailed' | undefined;
								parallelToolCalls?: boolean | undefined;
								maxToolCalls?: number | undefined;
								serviceTier?:
									'default' | 'auto' | 'standard' | 'flex' | 'priority' | 'reserved' | undefined;
								speed?: 'standard' | 'fast' | undefined;
								inferenceGeo?: 'us' | 'global' | undefined;
								sendReasoning?: boolean | undefined;
								includeThoughts?: boolean | undefined;
								safetyThreshold?:
									| 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'
									| 'BLOCK_LOW_AND_ABOVE'
									| 'BLOCK_MEDIUM_AND_ABOVE'
									| 'BLOCK_ONLY_HIGH'
									| 'BLOCK_NONE'
									| 'OFF'
									| undefined;
								mediaResolution?:
									| 'MEDIA_RESOLUTION_UNSPECIFIED'
									| 'MEDIA_RESOLUTION_LOW'
									| 'MEDIA_RESOLUTION_MEDIUM'
									| 'MEDIA_RESOLUTION_HIGH'
									| undefined;
								safePrompt?: boolean | undefined;
								documentImageLimit?: number | undefined;
								documentPageLimit?: number | undefined;
							}
					  >
					| undefined;
				baseUrl?: string | undefined;
			},
			{
				id: string;
				provider: LlmProvider;
				enabledModels: string[] | null;
				customModels: {
					id: string;
					displayName?: string | undefined;
					costPerM?:
						| {
								inputNoCache?: number | undefined;
								inputCacheRead?: number | undefined;
								inputCacheWrite?: number | undefined;
								output?: number | undefined;
						  }
						| undefined;
				}[];
				modelSettings: Record<
					string,
					{
						temperature?: number | undefined;
						topP?: number | undefined;
						topK?: number | undefined;
						maxOutputTokens?: number | undefined;
						reasoningEffort?: 'max' | 'off' | 'minimal' | 'low' | 'medium' | 'high' | undefined;
						thinkingBudgetTokens?: number | undefined;
						thinkingDisplay?: 'omitted' | 'updates' | 'summarized' | undefined;
						textVerbosity?: 'low' | 'medium' | 'high' | undefined;
						reasoningSummary?: 'auto' | 'detailed' | undefined;
						parallelToolCalls?: boolean | undefined;
						maxToolCalls?: number | undefined;
						serviceTier?: 'default' | 'auto' | 'standard' | 'flex' | 'priority' | 'reserved' | undefined;
						speed?: 'standard' | 'fast' | undefined;
						inferenceGeo?: 'us' | 'global' | undefined;
						sendReasoning?: boolean | undefined;
						includeThoughts?: boolean | undefined;
						safetyThreshold?:
							| 'HARM_BLOCK_THRESHOLD_UNSPECIFIED'
							| 'BLOCK_LOW_AND_ABOVE'
							| 'BLOCK_MEDIUM_AND_ABOVE'
							| 'BLOCK_ONLY_HIGH'
							| 'BLOCK_NONE'
							| 'OFF'
							| undefined;
						mediaResolution?:
							| 'MEDIA_RESOLUTION_UNSPECIFIED'
							| 'MEDIA_RESOLUTION_LOW'
							| 'MEDIA_RESOLUTION_MEDIUM'
							| 'MEDIA_RESOLUTION_HIGH'
							| undefined;
						safePrompt?: boolean | undefined;
						documentImageLimit?: number | undefined;
						documentPageLimit?: number | undefined;
					}
				>;
				baseUrl: string | null;
				apiKeyPreview: string | null;
				credentialPreviews: Record<string, string> | null;
			}
		>;
		validateMapBoundaryUrl: Procedure<
			{ url: string },
			{ propertyKeys: string[]; featureCount: number; geojson: FeatureCollection<Geometry, GeoJsonProperties> }
		>;
	};
	sharedChat: {
		create: Procedure<
			{
				chatId: string;
				visibility?: 'clinic' | 'specific' | undefined;
				allowedUserIds?: string[] | undefined;
				notify?: boolean | undefined;
			},
			{ id: string; createdAt: Date; chatId: string; visibility: 'clinic' | 'specific' }
		>;
		delete: Procedure<{ shareId: string }, void>;
		getShareOptionsByChatId: Procedure<
			{ chatId: string },
			| { shareId: null; visibility: null; allowedUserIds: never[] }
			| { shareId: string; visibility: string; allowedUserIds: string[] }
		>;
		getSharedChat: Procedure<
			{ shareId: string },
			{ share: SharedChatWithDetails; chat: UIChat; userRole: UserRole | null }
		>;
		list: Procedure<void, SharedChatWithDetails[]>;
		updateAccess: Procedure<{ shareId: string; allowedUserIds: string[] }, void>;
	};
	skill: {
		catalog: Procedure<void, Skill[]>;
		list: Procedure<void, Skill[]>;
		listLoadErrors: Procedure<void, SkillLoadError[]>;
		saveStatus: Procedure<void, { mode: string; message?: string | null }>;
		detail: Procedure<{ name: string }, { name: string; description: string; body: string; hash: string }>;
		create: Procedure<{ name: string; description: string; body: string }, { name: string; location: string }>;
		update: Procedure<
			{ name: string; description: string; body: string; expectedHash: string },
			{ name: string; hash: string }
		>;
		delete: Procedure<{ name: string; expectedHash: string }, void>;
	};
	storage: {
		getConfig: Procedure<void, StorageConfigSummary>;
		getHealth: Procedure<void, { checkedAt: Date; ok: boolean; error?: string | undefined }>;
		getUploadLimits: Procedure<void, { enabled: boolean; maxFileSizeMb: number }>;
		getUsage: Procedure<
			void,
			{
				own: StorageUsage;
				byUser: { name: string; userId: string; fileCount: number; totalBytes: number }[] | null;
			}
		>;
	};
	encounter: {
		list: Procedure<{ patientId: string }, EncounterFieldsFragment[]>;
		overview: Procedure<{ patientId: string }, PatientOverviewFieldsFragment>;
		create: Procedure<CreateEncounterInput, EncounterFieldsFragment>;
		atClinic: Procedure<ClinicEncountersInput, EncounterFieldsFragment[]>;
		transition: Procedure<TransitionEncounterInput, EncounterFieldsFragment>;
	};
	encounterRecord: {
		get: Procedure<{ encounterId: string }, EncounterRecordFieldsFragment | null>;
		allergies: Procedure<{ patientId: string }, AllergyFieldsFragment[]>;
		searchIcd10: Procedure<{ query: string }, SearchIcd10Query['searchIcd10']>;
		prescriptionPrint: Procedure<{ id: string }, PrescriptionPrintQuery['prescription']>;
		certificatePrint: Procedure<{ id: string }, MedicalCertificatePrintQuery['medicalCertificate']>;
		myPractitioner: Procedure<void, MyPractitionerQuery['myPractitioner']>;
		saveMyPractitioner: Procedure<SaveMyPractitionerInput, NonNullable<MyPractitionerQuery['myPractitioner']>>;
		updateNote: Procedure<UpdateEncounterNoteInput, { id: string; version: number }>;
		recordVitals: Procedure<RecordVitalsInput, { id: string }>;
		voidVitals: Procedure<VoidEntryInput, { id: string }>;
		addDiagnosis: Procedure<AddDiagnosisInput, { id: string }>;
		updateDiagnosis: Procedure<UpdateDiagnosisInput, { id: string }>;
		voidDiagnosis: Procedure<VoidEntryInput, { id: string }>;
		addAllergy: Procedure<AddAllergyInput, { id: string }>;
		voidAllergy: Procedure<VoidAllergyInput, { id: string }>;
		savePrescription: Procedure<SavePrescriptionInput, { id: string }>;
		issuePrescription: Procedure<{ id: string; overrideAllergyWarning?: boolean }, { id: string }>;
		voidPrescription: Procedure<VoidEntryInput, { id: string }>;
		saveCertificate: Procedure<SaveMedicalCertificateInput, { id: string }>;
		issueCertificate: Procedure<{ id: string }, { id: string }>;
		voidCertificate: Procedure<VoidEntryInput, { id: string }>;
	};
	billing: {
		get: Procedure<{ encounterId: string }, EncounterBillingFieldsFragment>;
		saveDraft: Procedure<SaveInvoiceDraftInput, { id: string; version: number }>;
		issue: Procedure<IssueInvoiceInput, { id: string; invoiceNo: string | null }>;
		recordPayment: Procedure<RecordPaymentInput, { id: string; status: string; balance: number }>;
		void: Procedure<VoidInvoiceInput, { id: string }>;
	};
	patient: {
		clinics: Procedure<void, MyCareClinicsQuery['myCareClinics']>;
		barangays: Procedure<{ cityMunicipalityCode: string }, BarangaysQuery['barangays']>;
		chat: Procedure<{ patientId: string }, string | null>;
		search: Procedure<SearchPatientsInput, PatientFieldsFragment[]>;
		get: Procedure<{ id: string }, PatientFieldsFragment | null>;
		checkDuplicates: Procedure<PatientDraftInput, PatientDuplicateFieldsFragment[]>;
		register: Procedure<
			RegisterPatientInput,
			{ patient: PatientFieldsFragment | null; duplicates: PatientDuplicateFieldsFragment[] }
		>;
		linkExisting: Procedure<LinkExistingPatientInput, PatientFieldsFragment>;
	};
	order: {
		tests: Procedure<void, DiagnosticTestFieldsFragment[]>;
		forEncounter: Procedure<{ encounterId: string }, DiagnosticOrderFieldsFragment[]>;
		create: Procedure<CreateDiagnosticOrderInput, DiagnosticOrderFieldsFragment>;
		cancel: Procedure<CancelDiagnosticOrderInput, { id: string; status: DiagnosticOrderStatus }>;
		worklist: Procedure<{ statuses?: DiagnosticOrderStatus[] | null }, LabWorklistItemFieldsFragment[]>;
		worklistCounts: Procedure<void, LabWorklistCountsQuery['labWorklistCounts']>;
		collect: Procedure<MarkSpecimenCollectedInput, { id: string; status: DiagnosticOrderStatus }>;
		start: Procedure<DiagnosticItemStepInput, { id: string; status: DiagnosticOrderStatus }>;
		enterResult: Procedure<EnterDiagnosticResultInput, LabWorklistItemFieldsFragment>;
		release: Procedure<DiagnosticItemStepInput, { id: string; status: DiagnosticOrderStatus }>;
	};
	result: {
		toReview: Procedure<void, DiagnosticReportFieldsFragment[]>;
		forPatient: Procedure<{ patientId: string }, DiagnosticReportFieldsFragment[]>;
		review: Procedure<ReviewResultInput, DiagnosticReportFieldsFragment>;
	};
	wiseProposal: {
		outcomes: Procedure<{ chatId: string }, WiseProposalOutcomeFieldsFragment[]>;
		cancel: Procedure<WiseOriginInput, WiseProposalOutcomeFieldsFragment>;
	};
	user: {
		getMemories: Procedure<
			void,
			{
				id: string;
				createdAt: Date;
				updatedAt: Date;
				userId: string;
				chatId: string | null;
				category: 'global_rule' | 'personal_fact';
				content: string;
				supersededBy: string | null;
			}[]
		>;
		getMemorySettings: Procedure<void, { memoryEnabled: boolean }>;
	};
}

type ApiProcedures = GraphQLProcedures;

export type ApiInputs = {
	[R in keyof ApiProcedures]: {
		[P in keyof ApiProcedures[R]]: ApiProcedures[R][P] extends Procedure<infer I, unknown> ? I : never;
	};
};
export type ApiOutputs = {
	[R in keyof ApiProcedures]: {
		[P in keyof ApiProcedures[R]]: ApiProcedures[R][P] extends Procedure<unknown, infer O> ? O : never;
	};
};
