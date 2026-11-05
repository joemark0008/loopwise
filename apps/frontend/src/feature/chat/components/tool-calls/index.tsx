import { memo } from 'react';
import { AnalyticsResultToolCall } from './analytics-result';
import { ClarificationToolCall } from './clarification';
import { ClinicalChartToolCall } from './clinical-chart';
import { DefaultToolCall } from './default';
import { DisplayChartToolCall } from './display-chart';
import { DisplayMapToolCall } from './display-map';
import { FindPatientToolCall } from './find-patient';
import { McpToolCall } from './mcp';
import { OpenPageToolCall } from './open-page';
import { ProposeAllergyToolCall, ProposeRemoveAllergyToolCall, ProposeVitalsToolCall } from './propose-action';
import { ProposeBillStepToolCall, ProposeChargesToolCall } from './propose-billing';
import {
	ListLabOrdersToolCall,
	ListResultsToReviewToolCall,
	ProposeCancelOrderToolCall,
	ProposeLabOrderStepToolCall,
	ProposeOrderToolCall,
	ProposeResultReviewToolCall,
} from './propose-diagnostics-actions';
import { ProposeEncounterToolCall } from './propose-encounter';
import { ProposeEncounterNoteToolCall } from './propose-encounter-note';
import { ProposeMedicalCertificateToolCall, ProposePrescriptionToolCall } from './propose-encounter-record';
import { ProposePatientRegistrationToolCall } from './propose-patient-registration';
import {
	ProposeDiagnosisToolCall,
	ProposeIssueDocumentToolCall,
	ProposePatientUpdateToolCall,
	ProposeSaveReportToolCall,
	ProposeVoidDiagnosisToolCall,
	ProposeVoidDocumentToolCall,
	ProposeVoidVitalsToolCall,
} from './propose-record-actions';
import {
	ListAppointmentsToolCall,
	ListQueueToolCall,
	ProposeAppointmentToolCall,
	ProposeRescheduleToolCall,
} from './propose-scheduling';
import { ProposeSkillToolCall } from './propose-skill';
import { ReportToolCall } from './report-card';
import { ReportChipToolCall } from './report-chip';
import { WebFetchToolCall } from './web-fetch';
import { WebSearchToolCall } from './web-search';
import type { StaticToolName, UIToolPart } from '@loopwise/api/agent/types/chat';
import { getToolName, isToolSettled } from '@/lib/ai';
import { ToolCallProvider } from '@/contexts/tool-call';
import { useAssistantMessage } from '@/contexts/assistant-message';

export type ToolCallComponentProps<TToolName extends StaticToolName | undefined = undefined> = {
	toolPart: UIToolPart<TToolName>;
};

const toolComponents: Partial<{
	[TToolName in StaticToolName]: React.ComponentType<ToolCallComponentProps<TToolName>>;
}> = {
	clarification: ClarificationToolCall,
	display_chart: DisplayChartToolCall,
	display_map: DisplayMapToolCall,
	propose_skill: ProposeSkillToolCall,
	propose_patient_registration: ProposePatientRegistrationToolCall,
	propose_encounter: ProposeEncounterToolCall,
	propose_encounter_note: ProposeEncounterNoteToolCall,
	find_patient: FindPatientToolCall,
	chart_patient_trend: ClinicalChartToolCall,
	chart_facility_panel: ClinicalChartToolCall,
	create_report: ReportToolCall,
	run_analytics_sql: AnalyticsResultToolCall,
	get_metric: AnalyticsResultToolCall,
	report: ReportChipToolCall,
	open_page: OpenPageToolCall,
	propose_prescription: ProposePrescriptionToolCall,
	propose_medical_certificate: ProposeMedicalCertificateToolCall,
	propose_charges: ProposeChargesToolCall,
	propose_vitals: ProposeVitalsToolCall,
	propose_allergy: ProposeAllergyToolCall,
	propose_remove_allergy: ProposeRemoveAllergyToolCall,
	list_results_to_review: ListResultsToReviewToolCall,
	propose_result_review: ProposeResultReviewToolCall,
	propose_order: ProposeOrderToolCall,
	propose_diagnosis: ProposeDiagnosisToolCall,
	propose_void_diagnosis: ProposeVoidDiagnosisToolCall,
	propose_void_vitals: ProposeVoidVitalsToolCall,
	propose_cancel_order: ProposeCancelOrderToolCall,
	list_lab_orders: ListLabOrdersToolCall,
	propose_lab_order_step: ProposeLabOrderStepToolCall,
	propose_issue_document: ProposeIssueDocumentToolCall,
	propose_void_document: ProposeVoidDocumentToolCall,
	propose_bill_step: ProposeBillStepToolCall,
	propose_save_report: ProposeSaveReportToolCall,
	propose_patient_update: ProposePatientUpdateToolCall,
	list_appointments: ListAppointmentsToolCall,
	list_queue: ListQueueToolCall,
	propose_appointment: ProposeAppointmentToolCall,
	propose_reschedule: ProposeRescheduleToolCall,
};

export const dynamicToolComponents = {
	web_search: WebSearchToolCall,
	web_fetch: WebFetchToolCall,
	google_search: WebSearchToolCall,
	mcp_call: McpToolCall,
	mcp_connect: McpToolCall,
} satisfies Record<string, React.ComponentType<ToolCallComponentProps>>;

export type DynamicToolName = keyof typeof dynamicToolComponents;

export const ToolCall = memo(({ toolPart }: { toolPart: UIToolPart }) => {
	const { isSettled: isMessageSettled } = useAssistantMessage();

	// Neither is the agent talking to the user: follow-ups render in their own strip, and a
	// built-in skill is internal guidance nobody should have to see the agent consult.
	if (toolPart.type === 'tool-suggest_follow_ups' || toolPart.type === 'tool-load_skill') {
		return null;
	}

	const toolName = getToolName(toolPart);

	const Component =
		(toolComponents[toolName as StaticToolName] as React.ComponentType<ToolCallComponentProps> | undefined) ??
		dynamicToolComponents[toolName as DynamicToolName];

	const Rendered = Component ? <Component toolPart={toolPart} /> : <DefaultToolCall toolPart={toolPart} />;

	return (
		<ToolCallProvider
			value={{
				toolPart,
				// Check if the assistant message itself is settled in case tool execution was interrupted and persisted as not settled (e.g. input streaming).
				isSettled: isMessageSettled || isToolSettled(toolPart),
			}}
		>
			{Rendered}
		</ToolCallProvider>
	);
});
