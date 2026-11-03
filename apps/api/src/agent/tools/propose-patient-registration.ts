import { PatientDraftSchema } from '@loopwise/shared/patient-registration';
import { proposePatientRegistration } from '@loopwise/shared/tools';

import { createTool } from '../utils/tools.js';

/**
 * Offers a prefilled patient registration in a card (DESIGN.md §9.1). It writes nothing: only the clinician registers
 * the patient, with the card's Confirm button (`registerPatient`). It reads the user's facilities and, once the draft
 * is complete, the possible duplicates, so the card opens with them.
 */
export default createTool<proposePatientRegistration.Input, proposePatientRegistration.Output>({
	kind: 'propose',
	description: proposePatientRegistration.description,
	inputSchema: proposePatientRegistration.InputSchema,
	outputSchema: proposePatientRegistration.OutputSchema,
	execute: async (input, context) => {
		const facilities = await context.services.patients.myFacilities(context.userId);
		if (facilities.length === 0) {
			throw new Error('The user does not work at a facility, so they cannot register patients.');
		}
		const isComplete = PatientDraftSchema.safeParse(input).success;
		const duplicates = isComplete
			? await context.services.patients.checkDuplicates(context.userId, {
					...input,
					sex: input.sex!,
					birthDate: input.birthDate!,
					facilityId: facilities[0].id,
				})
			: [];
		return {
			_version: '1' as const,
			success: true as const,
			facilities: facilities.map(({ id, name }) => ({ id, name })),
			duplicates,
		};
	},

	toModelOutput: ({ output }) => ({
		type: 'text',
		value: [
			'Registration form shown to the user. Nothing is saved yet.',
			output.duplicates.some((duplicate) => duplicate.match === 'EXACT_IDENTIFIER')
				? 'An identifier already belongs to a registered patient: the card offers that record instead, so do not suggest registering again.'
				: output.duplicates.length > 0
					? 'A patient with the same name, birth date and sex exists: the card asks the user whether it is the same person.'
					: '',
			'Stop and wait for their reply.',
		]
			.filter(Boolean)
			.join(' '),
	}),
});
