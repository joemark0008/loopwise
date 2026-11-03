import { APP_PAGES, parseAppPageParams } from '@quarry/shared/app-pages';
import { openPage } from '@quarry/shared/tools';

import { createTool } from '../utils/tools.js';

/**
 * Opens a page of the app for the user (DESIGN.md §9.2): Wise picks a key of the `APP_PAGES` registry, never a URL.
 * A patient's pages are only offered when the user may see the patient, so navigating never gets around access rules.
 */
export default createTool<openPage.Input, openPage.Output>({
	kind: 'navigate',
	description: openPage.description,
	inputSchema: openPage.InputSchema,
	outputSchema: openPage.OutputSchema,
	execute: async ({ page: key, params: rawParams, userAskedToOpen }, context) => {
		const parsed = parseAppPageParams(key, rawParams);
		if (!parsed.success) {
			throw new Error(`Wrong params for ${key}: ${parsed.error}`);
		}
		let label: string = APP_PAGES[key].label;
		// Every page of a patient (chart, results, cases, messages) is read as the user, so access rules apply.
		if ('patientId' in parsed.params) {
			const patient = await context.services.patients.getById(
				context.userId,
				parsed.params.patientId,
				'Wise open_page',
			);
			if (!patient) {
				throw new Error(
					'No patient the user may see has this id. Use find_patient and only ids it returned; never guess.',
				);
			}
			const name = `${patient.givenName} ${patient.familyName}`;
			label = key === 'patients.detail' ? `${name}'s chart` : `${APP_PAGES[key].label} (${name})`;
		}
		return {
			_version: '1' as const,
			key,
			params: parsed.params,
			label,
			// A chart chat sits beside the chart the clinician is working on: it offers the link, never jumps away.
			autoNavigate: userAskedToOpen && !context.patientId,
		};
	},

	toModelOutput: ({ output }) => ({
		type: 'text',
		value: output.autoNavigate
			? `Opening ${output.label} for the user. Do not call more tools; end your turn.`
			: `Link to ${output.label} shown to the user.`,
	}),
});
