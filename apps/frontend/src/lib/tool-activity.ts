import { isQueryToolAgentName, QUERY_TOOL_NAME_PREFIX } from '@loopwise/shared/query-tools';
import type { UIToolPart } from '@loopwise/api/agent/types/chat';
import type { GroupablePart } from '@/types/ai';
import { getToolName, isReasoningPart, isToolSettled } from '@/lib/ai';
import { getFileName, getReadContextLabel } from '@/lib/file-path';
import { getMcpTarget } from '@/lib/mcp';

type ToolInput = Record<string, unknown>;

/** Describes the latest tool call for a collapsed group title without flashing back to the summary. */
export const getLatestToolActivityLabel = (parts: GroupablePart[]): string | null => {
	const latestPart = findLatestToolPart(parts);
	return latestPart ? describeToolActivity(latestPart) : null;
};

/** Parallel calls can settle out of order, so the newest call still running wins over the newest call overall. */
const findLatestToolPart = (parts: GroupablePart[]): UIToolPart | undefined => {
	const toolParts = parts.filter(isToolPart).reverse();
	return toolParts.find(isRunning) ?? toolParts[0];
};

const isToolPart = (part: GroupablePart): part is UIToolPart => {
	return !isReasoningPart(part);
};

const isRunning = (part: UIToolPart): boolean => {
	return !isToolSettled(part);
};

const describeToolActivity = (part: UIToolPart): string | null => {
	const input = (part.input ?? {}) as ToolInput;

	const toolName = getToolName(part);
	if (isQueryToolAgentName(toolName)) {
		return `Running ${toolName.slice(QUERY_TOOL_NAME_PREFIX.length)}`;
	}

	switch (toolName) {
		case 'read':
			return describeRead(input);
		case 'write':
			return withAsset('Saving', getFileName(asString(input.file_path)));
		case 'str_replace':
			return withAsset('Editing', getFileName(asString(input.file_path)));
		case 'search':
		case 'grep':
			return withAsset('Searching', asString(input.pattern));
		case 'list':
			return describeList(input);
		case 'execute_sql':
		case 'execute_semantic_query':
			return withAsset('Running', asString(input.name)) ?? 'Running query';
		case 'propose_skill':
			return 'Drafting the skill';
		case 'propose_patient_registration':
			return 'Preparing the registration';
		case 'propose_encounter':
			return 'Drafting the encounter';
		case 'find_patient':
			return withAsset('Looking up', asString(input.query)) ?? 'Looking up the patient';
		case 'open_page':
			return 'Opening the page';
		case 'chart_patient_trend':
			return withAsset('Charting', asString(input.measure)?.replaceAll('_', ' ')) ?? 'Charting the trend';
		case 'chart_facility_panel':
			return (
				withAsset('Counting', asString(input.metric)?.replaceAll('_', ' ')) ?? 'Counting across the facility'
			);
		case 'describe_analytics':
			return 'Reading the analytics views';
		case 'run_analytics_sql':
			return withAsset('Querying', asString(input.purpose)) ?? 'Querying your data';
		case 'get_metric':
			return withAsset('Counting', asString(input.metric)?.replaceAll('_', ' ')) ?? 'Getting the metric';
		case 'report':
			return withAsset('Writing', asString(input.title)) ?? 'Writing the report';
		case 'create_report':
			return 'Building the summary';
		case 'propose_encounter_note':
			return 'Drafting the note';
		case 'propose_prescription':
			return 'Drafting the prescription';
		case 'propose_medical_certificate':
			return 'Drafting the medical certificate';
		case 'propose_charges':
			return 'Drafting the bill';
		case 'propose_sql':
			return 'Preparing the query';
		case 'propose_vitals':
			return 'Drafting the vitals';
		case 'propose_allergy':
		case 'propose_remove_allergy':
			return 'Drafting the allergy change';
		case 'list_results_to_review':
			return 'Reading the results to review';
		case 'propose_result_review':
			return 'Drafting the review';
		case 'propose_order':
			return 'Drafting the order';
		case 'propose_diagnosis':
		case 'propose_void_diagnosis':
			return 'Drafting the diagnosis';
		case 'propose_void_vitals':
			return 'Drafting the vitals change';
		case 'propose_cancel_order':
			return 'Drafting the cancellation';
		case 'list_lab_orders':
			return 'Reading the worklist';
		case 'propose_lab_order_step':
			return 'Drafting the order step';
		case 'propose_issue_document':
		case 'propose_void_document':
			return 'Drafting the document change';
		case 'propose_bill_step':
			return 'Drafting the bill step';
		case 'propose_save_report':
			return 'Preparing to save the report';
		case 'propose_patient_update':
			return 'Drafting the contact change';
		case 'mcp_call':
			return describeMcpCall(input);
		case 'mcp_connect':
			return withAsset('Connecting to', asString(input.server));
		default:
			return `Running ${humanizeToolName(toolName)}`;
	}
};

const describeRead = (input: ToolInput): string | null => {
	const filePath = asString(input.file_path);
	const mcpTarget = getMcpTarget(filePath);
	if (mcpTarget) {
		return mcpTarget.tool && mcpTarget.server
			? `Loading ${mcpTarget.tool} from ${mcpTarget.server}`
			: `Loading ${mcpTarget.server ?? 'MCP servers'}`;
	}

	const fileName = getFileName(filePath);
	const contextLabel = getReadContextLabel(filePath);
	if (!fileName) {
		return null;
	}
	return contextLabel ? `Exploring ${fileName} from ${contextLabel}` : `Exploring ${fileName}`;
};

const describeList = (input: ToolInput): string | null => {
	const path = asString(input.path);
	const mcpTarget = getMcpTarget(path);
	if (!mcpTarget) {
		return withAsset('Exploring', path);
	}
	return mcpTarget.server ? `Listing ${mcpTarget.server} MCP tools` : 'Listing MCP servers';
};

const describeMcpCall = (input: ToolInput): string | null => {
	const server = asString(input.server);
	const tool = asString(input.tool);
	if (!server || !tool) {
		return null;
	}
	return `Using ${tool} from ${server}`;
};

const humanizeToolName = (toolName: string): string => {
	return toolName.replaceAll('_', ' ');
};

const withAsset = (verb: string, asset: string | undefined): string | null => {
	return asset ? `${verb} ${asset}` : null;
};

const asString = (value: unknown): string | undefined => {
	return typeof value === 'string' && value.trim() !== '' ? value : undefined;
};
