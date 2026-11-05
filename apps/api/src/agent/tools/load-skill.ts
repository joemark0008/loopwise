import { isSkillGranted } from '@loopwise/shared';
import { loadSkill } from '@loopwise/shared/tools';

import type { Skill } from '../../skills/skill.service.js';
import { isClinicContextPathAllowed } from '../services/clinic-context-path-access.service.js';
import type { SkillCapabilities } from '../skills/index.js';
import { findInternalSkill, internalSkillNames } from '../skills/index.js';
import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

export default createTool<loadSkill.Input, loadSkill.Output>({
	kind: 'read',
	description: loadSkill.description,
	inputSchema: loadSkill.InputSchema,
	outputSchema: loadSkill.OutputSchema,
	execute: async ({ name }, context) => {
		const clinicSkill = loadClinicSkill(name, context);
		if (clinicSkill) {
			return clinicSkill;
		}

		const internalSkill = findInternalSkill(name);
		if (internalSkill) {
			return {
				_version: '1' as const,
				name: internalSkill.name,
				body: internalSkill.body(skillCapabilities(context)),
			};
		}

		throw new Error(`There is no skill called '${name}'. Available: ${availableSkillNames(context).join(', ')}.`);
	},

	toModelOutput: ({ output }) => ({ type: 'text', value: output.body }),
});

/** Mirrors how the tool set itself is assembled, so a skill only offers tools the run really has (no sandbox in Loopwise). */
const skillCapabilities = (_context: ToolContext | undefined): SkillCapabilities => {
	return { canRunSandbox: false };
};

/**
 * A clinic skill shadows the built-in skill of the same name, as the prompt lists it in its place.
 * A clinic skill the run may not reach is reported as missing, so its existence does not leak.
 */
const loadClinicSkill = (name: string, context: ToolContext | undefined): loadSkill.Output | null => {
	if (!context?.clinicId) {
		return null;
	}

	const skill = context.services.skills.getSkill(context.clinicId, name);
	if (!skill || !isClinicSkillAllowed(skill, context)) {
		return null;
	}

	const body = context.services.skills.getSkillBody(context.clinicId, skill.name);
	return body ? { _version: '1' as const, name: skill.name, body } : null;
};

/** The same checks the read tool applies to the skill file, on top of the skill grant itself. */
const isClinicSkillAllowed = (skill: Skill, context: ToolContext): boolean => {
	return (
		isSkillGranted(context.skillsAccess, skill.name) &&
		isClinicContextPathAllowed(context, skill.location, skill.location, 'file')
	);
};

const availableSkillNames = (context: ToolContext | undefined): string[] => {
	const clinicSkillNames = context?.clinicId
		? context.services.skills
				.getSkills(context.clinicId)
				.filter((skill) => isClinicSkillAllowed(skill, context))
				.map((skill) => skill.name)
		: [];
	return [...new Set([...internalSkillNames(), ...clinicSkillNames])];
};
