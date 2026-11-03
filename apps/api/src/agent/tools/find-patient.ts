import { findPatient } from '@quarry/shared/tools';

import { createTool } from '../utils/tools.js';

/**
 * Looks patients up for Wise (DESIGN.md §9.2), as the signed-in user: row-level security decides what it finds and
 * every patient it returns is audited as a view. Reads only.
 */
export default createTool<findPatient.Input, findPatient.Output>({
	kind: 'read',
	description: findPatient.description,
	inputSchema: findPatient.InputSchema,
	outputSchema: findPatient.OutputSchema,
	execute: async ({ query, birthDate }, context) => {
		if (!query?.trim() && !birthDate?.trim()) {
			throw new Error('Give a name, an identifier or a birth date to search for.');
		}
		const { patients, truncated } = await context.services.patients.findForWise(
			context.userId,
			{ query: query?.trim() || undefined, birthDate: birthDate?.trim() || undefined },
			findPatient.MAX_MATCHES,
		);
		return {
			_version: '1' as const,
			patients: patients.map(({ id, givenName, familyName, birthDate, sex, identifiers }) => ({
				id,
				name: `${givenName} ${familyName}`,
				birthDate,
				sex,
				identifiers: identifiers.map(({ system, value }) => ({ system, value })),
			})),
			truncated,
		};
	},
});
