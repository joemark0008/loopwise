import { proposeEncounter } from '@loopwise/shared/tools';

import { createTool } from '../utils/tools.js';

/**
 * Offers a draft encounter for the patient of a chart chat (DESIGN.md §7.1). It writes nothing: the clinician records
 * it with the card's Confirm button (`createEncounter`), which links it back to this chat.
 */
export default createTool<proposeEncounter.Input, proposeEncounter.Output>({
	kind: 'propose',
	description: proposeEncounter.description,
	inputSchema: proposeEncounter.InputSchema,
	outputSchema: proposeEncounter.OutputSchema,
	execute: async (_input, context) => {
		if (!context.patientId) {
			throw new Error(
				"This chat isn't about a patient. Ask the user to open the patient's chart (Patients) and ask Wise there.",
			);
		}
		const facilities = await context.services.patients.myFacilities(context.userId);
		if (facilities.length === 0) {
			throw new Error('The user does not work at a facility, so they cannot record encounters.');
		}
		return {
			_version: '1' as const,
			success: true as const,
			patientId: context.patientId,
			facilities: facilities.map(({ id, name }) => ({ id, name })),
		};
	},

	toModelOutput: () => ({
		type: 'text',
		value: 'Encounter draft shown to the user. Nothing is saved yet. Stop and wait for their reply.',
	}),
});
