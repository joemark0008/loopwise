import { proposeEncounterNote } from '@quarry/shared/tools';

import { createTool } from '../utils/tools.js';

/**
 * Offers a change to an encounter's SOAP note as a before → after card (DESIGN.md §9.1). It writes nothing: it reads
 * the note as the user and returns it with its version; only the card's Confirm saves (`updateEncounterNote`), and only
 * if the note hasn't changed since.
 */
export default createTool<proposeEncounterNote.Input, proposeEncounterNote.Output>({
	kind: 'propose',
	description: proposeEncounterNote.description,
	inputSchema: proposeEncounterNote.InputSchema,
	outputSchema: proposeEncounterNote.OutputSchema,
	execute: async ({ encounterId }, context) => {
		if (!context.patientId) {
			throw new Error(
				"This chat isn't about a patient. Ask the user to open the patient's chart (Patients) and ask Wise there.",
			);
		}
		const draftBase = await context.services.encounters.getNoteForWise(
			context.userId,
			context.patientId,
			encounterId?.trim() || undefined,
		);
		return { _version: '1' as const, success: true as const, ...draftBase };
	},

	toModelOutput: () => ({
		type: 'text',
		value: 'Note change shown to the user as a before → after card. Nothing is saved yet. Stop and wait for their reply.',
	}),
});
