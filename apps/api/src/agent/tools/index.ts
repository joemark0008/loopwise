import type { CustomBoundarySet } from '@loopwise/shared';
import {
	proposeAllergy,
	proposeAppointment,
	proposeBillStep,
	proposeCancelOrder,
	proposeDiagnosis,
	proposeIssueDocument,
	proposeLabOrderStep,
	proposeOrder,
	proposePatientUpdate,
	proposeRemoveAllergy,
	proposeReschedule,
	proposeResultReview,
	proposeSaveReport,
	proposeVitals,
	proposeVoidDiagnosis,
	proposeVoidDocument,
	proposeVoidVitals,
} from '@loopwise/shared/wise-actions';

import type { AgentSettings } from '../types/agent-settings.js';
import { getToolKind } from '../utils/tools.js';
import { createActionTool } from './action-tool.js';
import chartFacilityPanel from './chart-facility-panel.js';
import chartPatientTrend from './chart-patient-trend.js';
import clarification from './clarification.js';
import createReport from './create-report.js';
import describeAnalytics from './describe-analytics.js';
import displayChart from './display-chart.js';
import { createDisplayMapTool } from './display-map.js';
import findPatient from './find-patient.js';
import getMetric from './get-metric.js';
import listAppointments from './list-appointments.js';
import listLabOrders from './list-lab-orders.js';
import listQueue from './list-queue.js';
import listResultsToReview from './list-results-to-review.js';
import loadSkill from './load-skill.js';
import openPage from './open-page.js';
import proposeEncounter from './propose-encounter.js';
import proposeEncounterNote from './propose-encounter-note.js';
import {
	proposeChargesTool,
	proposeMedicalCertificateTool,
	proposePrescriptionTool,
} from './propose-encounter-record.js';
import proposePatientRegistration from './propose-patient-registration.js';
import proposeSkill from './propose-skill.js';
import readAttachment from './read-attachment.js';
import reportTool from './report.js';
import runAnalyticsSql from './run-analytics-sql.js';
import suggestFollowUps from './suggest-follow-ups.js';

export { createWebSearchTools } from './web-search.js';

/**
 * Loopwise keeps loopwise's conversational tools only (DESIGN.md §11). The warehouse, SQL, semantic layer, sandbox,
 * story, onboarding and context-recommendation tools are gone; the clinical tools (§7.2) come with their modules.
 * `display_map` needs the map setting.
 *
 * Only the MCP sub-agent excludes `display_map` upstream; kept for when it's ported.
 */
export const MCP_SUB_AGENT_EXCLUDED_TOOLS = ['display_map'];

export const tools = {
	clarification,
	display_chart: displayChart,
	load_skill: loadSkill,
	suggest_follow_ups: suggestFollowUps,
	propose_skill: proposeSkill,
	propose_patient_registration: proposePatientRegistration,
	propose_encounter: proposeEncounter,
	propose_encounter_note: proposeEncounterNote,
	find_patient: findPatient,
	read_attachment: readAttachment,
	open_page: openPage,
	propose_prescription: proposePrescriptionTool,
	propose_medical_certificate: proposeMedicalCertificateTool,
	propose_charges: proposeChargesTool,
	chart_patient_trend: chartPatientTrend,
	chart_facility_panel: chartFacilityPanel,
	create_report: createReport,
	describe_analytics: describeAnalytics,
	run_analytics_sql: runAnalyticsSql,
	get_metric: getMetric,
	report: reportTool,
	// Wise actions (DESIGN.md §7.3): one definition each in `@loopwise/shared/wise-actions`, one shared card.
	propose_vitals: createActionTool(proposeVitals),
	propose_allergy: createActionTool(proposeAllergy),
	propose_remove_allergy: createActionTool(proposeRemoveAllergy),
	list_results_to_review: listResultsToReview,
	propose_result_review: createActionTool(proposeResultReview),
	propose_order: createActionTool(proposeOrder),
	propose_diagnosis: createActionTool(proposeDiagnosis),
	propose_void_diagnosis: createActionTool(proposeVoidDiagnosis),
	propose_void_vitals: createActionTool(proposeVoidVitals),
	propose_cancel_order: createActionTool(proposeCancelOrder),
	list_lab_orders: listLabOrders,
	propose_lab_order_step: createActionTool(proposeLabOrderStep),
	propose_issue_document: createActionTool(proposeIssueDocument),
	propose_void_document: createActionTool(proposeVoidDocument),
	propose_bill_step: createActionTool(proposeBillStep),
	propose_save_report: createActionTool(proposeSaveReport),
	propose_patient_update: createActionTool(proposePatientUpdate),
	list_appointments: listAppointments,
	list_queue: listQueue,
	propose_appointment: createActionTool(proposeAppointment),
	propose_reschedule: createActionTool(proposeReschedule),
};

export const uiToolset = { ...tools, display_map: createDisplayMapTool() };

export const getTools = (
	agentSettings: AgentSettings | null,
	extraTools?: Record<string, unknown>,
	options: {
		excludeFollowUps?: boolean;
		/** Restricts built-in tools to this allowlist by name; `extraTools` are always kept. */
		builtinToolAllowlist?: string[];
		/** Drops these built-in tools from the returned set. */
		excludeBuiltinTools?: string[];
		/** Custom GeoJSON boundary sets defined by the clinic admin. */
		customBoundaries?: CustomBoundarySet[];
	} = {},
) => {
	// display_chart and display_map plot an execute_sql result, and the SQL tools are gone: they stay in `uiToolset`
	// so old chats render, but the model charts through chart_patient_trend (DESIGN.md §7.2). chart_facility_panel
	// gave way to the certified metrics (get_metric), one definition per number; its card still renders old chats.
	const { suggest_follow_ups, display_chart: _displayChart, chart_facility_panel: _facilityPanel, ...rest } = tools;
	const allTools = {
		...rest,
		...(!options.excludeFollowUps && { suggest_follow_ups }),
		...extraTools,
	};

	let result = allTools;
	if (options.builtinToolAllowlist) {
		const allowed = new Set(options.builtinToolAllowlist);
		result = keepTools(result, extraTools, (name) => allowed.has(name));
	}
	if (options.excludeBuiltinTools) {
		const excluded = new Set(options.excludeBuiltinTools);
		result = keepTools(result, extraTools, (name) => !excluded.has(name));
	}
	assertToolKinds(result);
	return result;
};

/**
 * Fails closed: every tool the model gets must declare what it does (DESIGN.md §7.1), so a tool that could write
 * without the clinician's Confirm can't slip in unclassified.
 */
export const assertToolKinds = (toolset: Record<string, unknown>): void => {
	const unclassified = Object.entries(toolset)
		.filter(([, toolDefinition]) => !getToolKind(toolDefinition))
		.map(([name]) => name);
	if (unclassified.length > 0) {
		throw new Error(
			`Agent tools without a kind: ${unclassified.join(', ')}. Declare one with createTool or withToolKind.`,
		);
	}
};

const keepTools = <T extends Record<string, unknown>>(
	toolset: T,
	extraTools: Record<string, unknown> | undefined,
	shouldKeep: (name: string) => boolean,
): T => {
	const extraToolNames = new Set(Object.keys(extraTools ?? {}));
	return Object.fromEntries(
		Object.entries(toolset).filter(([name]) => shouldKeep(name) || extraToolNames.has(name)),
	) as T;
};
