import { proposeScribeNote } from '@loopwise/shared/tools';

import { createTool } from '../utils/tools.js';

/**
 * The AI scribe (DESIGN.md §7.5): one draft of a whole consultation from its transcript or dictation, in parts the
 * doctor confirms one by one on the encounter page. It writes nothing: it reads the visit as the user (the chat's
 * patient's, theirs to add to), checks the ICD-10 codes, matches the tests to the catalog and lists the allergies the
 * drafted medicines hit. Each part's card saves through that record's own mutation, once.
 */
export default createTool<proposeScribeNote.Input, proposeScribeNote.Output>({
	kind: 'propose',
	description: proposeScribeNote.description,
	inputSchema: proposeScribeNote.InputSchema,
	outputSchema: proposeScribeNote.OutputSchema,
	execute: async (input, context) => {
		if (!context.patientId) {
			throw new Error(
				"This chat isn't about a patient. Ask the user to open the patient's chart (Patients) and ask Wise there.",
			);
		}
		const encounterId = input.encounterId?.trim();
		if (!encounterId) {
			throw new Error('Name the encounter: use the id from the patient record.');
		}
		if (proposeScribeNote.draftParts(input).length === 0) {
			throw new Error(
				'The draft is empty. Put what was said into its parts, or ask the doctor for the dictation.',
			);
		}
		const draft = await context.services.scribe.draftForWise(context.userId, context.patientId, {
			...input,
			encounterId,
		});
		return { _version: '1' as const, success: true as const, ...draft };
	},
	toModelOutput: ({ output }) => ({
		type: 'text',
		value: [
			`Scribe draft shown to the doctor as ${output.parts.length} cards on the visit's AI scribe tab. Nothing is saved yet;`,
			'the doctor confirms, edits or dismisses each card. Say in one or two lines what you drafted, then stop.',
			...(output.allergyWarnings.length > 0
				? [
						`Allergy warning: ${output.allergyWarnings.map((warning) => `${warning.genericName} (allergy: ${warning.allergen})`).join(', ')}. Tell the doctor.`,
					]
				: []),
			...(output.diagnoses.some((diagnosis) => !diagnosis.known)
				? [
						`Not in the ICD-10 list: ${output.diagnoses
							.filter((diagnosis) => !diagnosis.known)
							.map((diagnosis) => diagnosis.icd10Code)
							.join(', ')}; the doctor picks a code in the card.`,
					]
				: []),
			...(output.tests.unmatched.length > 0
				? [`Not in the clinic's test list: ${output.tests.unmatched.join(', ')}.`]
				: []),
		].join(' '),
	}),
});
