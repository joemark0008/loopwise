import { findLabTest, LAB_TESTS } from '@loopwise/shared/lab-tests';
import { type ActionOutput, ActionOutputSchema, type WiseActionDefinition } from '@loopwise/shared/wise-actions';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * The tool of a Wise action (DESIGN.md §7.3): `propose`, so it writes nothing. It checks the chat and names the
 * record the card is about; the card loads that record as the clinician (row-level security, the patient check), and
 * only its Confirm calls the action's mutation, which accepts the card from this tool only (`wiseActionToolsFor`).
 */
export function createActionTool<TInput>(action: WiseActionDefinition<TInput>) {
	return createTool<TInput, ActionOutput>({
		kind: 'propose',
		description: action.description,
		inputSchema: action.InputSchema,
		outputSchema: ActionOutputSchema,
		execute: async (input, context: ToolContext) => {
			if (action.patientChat !== false && !context.patientId) {
				throw new Error(
					"This chat isn't about a patient. Ask the user to open the patient's chart (Patients) and ask Wise there.",
				);
			}
			const fields = input as Record<string, unknown>;
			const subjectId = subjectIdOf(action, fields);
			return {
				_version: '1' as const,
				success: true as const,
				...(context.patientId && { patientId: context.patientId }),
				...(subjectId && { subjectId }),
				...(action.name === 'propose_order' && { tests: resolveTests(fields.tests) }),
			};
		},
		toModelOutput: () => ({
			type: 'text',
			value: 'Draft shown to the user. Nothing is saved yet. Stop and wait for their reply.',
		}),
	});
}

function subjectIdOf(action: WiseActionDefinition, input: Record<string, unknown>): string | undefined {
	const key = {
		encounter: 'encounterId',
		result: 'resultId',
		order: 'itemId',
		report: 'reportId',
		patient: null,
	}[action.subject];
	if (!key) {
		return undefined;
	}
	const id = typeof input[key] === 'string' ? input[key].trim() : '';
	if (!id) {
		throw new Error(
			{
				encounter:
					'Name the encounter: use the id from the patient record, or propose_encounter for a new visit.',
				result: 'Name the result: use the id from list_results_to_review.',
				order: 'Name the test: use the item id from list_lab_orders.',
				report: 'Name the report: use the id the report tool returned.',
				patient: '',
			}[action.subject],
		);
	}
	return id;
}

/** The standard tests the clinician named; an unknown name goes back to the model with the list. */
function resolveTests(names: unknown) {
	const list = Array.isArray(names) ? names.map(String) : [];
	const unknown = list.filter((name) => !findLabTest(name));
	if (list.length === 0 || unknown.length > 0) {
		throw new Error(
			`Not an orderable test: ${unknown.join(', ') || '(none)'}. The tests that can be ordered are: ` +
				`${LAB_TESTS.map((test) => test.display).join(', ')}. Ask the clinician if unsure.`,
		);
	}
	const tests = list.map((name) => findLabTest(name)!);
	return tests
		.filter((test, index) => tests.findIndex((other) => other.code === test.code) === index)
		.map(({ code, display, category }) => ({ code, display, category }));
}
