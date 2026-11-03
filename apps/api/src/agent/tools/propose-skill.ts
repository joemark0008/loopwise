import { proposeSkill } from '@loopwise/shared/tools';

import { findInternalSkill } from '../skills/index.js';
import { createTool } from '../utils/tools.js';

/** Offers a skill draft in a card. It has no side effects: only a person can save a skill, through `createSkill`. */
export default createTool<proposeSkill.Input, proposeSkill.Output>({
	kind: 'propose',
	description: proposeSkill.description,
	inputSchema: proposeSkill.InputSchema,
	outputSchema: proposeSkill.OutputSchema,
	execute: async ({ name }, context) => {
		if (findInternalSkill(name) || context.services.skills.getSkill(context.projectId, name)) {
			throw new Error(`A skill called '${name}' already exists. Choose another name.`);
		}
		return { _version: '1' as const, success: true as const };
	},

	toModelOutput: () => ({
		type: 'text',
		value: 'Draft shown to the user. Nothing is saved yet. Stop and wait for their reply.',
	}),
});
