import { isSkillGranted } from '@loopwise/shared';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { fullClinicContextAccess } from '../agent/services/user-group-context-access.service.js';
import { ClinicAccess } from '../common/decorators/access.decorator.js';
import { CurrentClinic } from '../common/decorators/current.decorator.js';
import type { Clinic } from '../generated/prisma/client.js';
import { ClinicContextAdmin } from './context-admin.decorator.js';
import { CreateSkillInput, DeleteSkillInput, UpdateSkillInput } from './dto/skill.input.js';
import {
	CreatedSkill,
	Skill,
	SkillDetail,
	SkillLoadError,
	SkillSaveStatus,
	UpdatedSkill,
} from './models/skill.model.js';
import { SkillService } from './skill.service.js';
import { SkillAuthoringService } from './skill-authoring.service.js';

/**
 * Upstream tRPC `skill.*`, plus writing skills from the app. The Markdown files stay the source of truth.
 * User-group skill grants are Phase 6: every member sees every skill until then.
 */
@Resolver(() => Skill)
export class SkillsResolver {
	constructor(
		private readonly skillService: SkillService,
		private readonly authoring: SkillAuthoringService,
	) {}

	@ClinicAccess()
	@Query(() => [Skill], { description: 'The clinic skills the signed-in user may use (the `/` picker).' })
	async skills(@CurrentClinic() clinic: Clinic): Promise<Skill[]> {
		await this.skillService.initializeSkills(clinic.id);
		const { skillsAccess } = fullClinicContextAccess();
		return this.skillService.getSkills(clinic.id).filter((skill) => isSkillGranted(skillsAccess, skill.name));
	}

	@ClinicContextAdmin()
	@Query(() => [Skill], { description: 'Every clinic skill, for the admin settings.' })
	async skillCatalog(@CurrentClinic() clinic: Clinic): Promise<Skill[]> {
		await this.skillService.initializeSkills(clinic.id);
		return this.skillService.getSkills(clinic.id);
	}

	@ClinicContextAdmin()
	@Query(() => [SkillLoadError])
	async skillLoadErrors(@CurrentClinic() clinic: Clinic): Promise<SkillLoadError[]> {
		await this.skillService.initializeSkills(clinic.id);
		return this.skillService.getSkillLoadErrors(clinic.id);
	}

	@ClinicContextAdmin()
	@Query(() => SkillSaveStatus)
	skillSaveStatus(@CurrentClinic() clinic: Clinic): SkillSaveStatus {
		return this.authoring.getSaveStatus(clinic);
	}

	@ClinicContextAdmin()
	@Query(() => SkillDetail)
	skillDetail(@CurrentClinic() clinic: Clinic, @Args('name') name: string): Promise<SkillDetail> {
		return this.authoring.getDetail(clinic, name);
	}

	@ClinicContextAdmin()
	@Mutation(() => CreatedSkill)
	createSkill(@CurrentClinic() clinic: Clinic, @Args('input') input: CreateSkillInput): Promise<CreatedSkill> {
		return this.authoring.create(clinic, input);
	}

	@ClinicContextAdmin()
	@Mutation(() => UpdatedSkill)
	updateSkill(@CurrentClinic() clinic: Clinic, @Args('input') input: UpdateSkillInput): Promise<UpdatedSkill> {
		return this.authoring.update(clinic, input);
	}

	@ClinicContextAdmin()
	@Mutation(() => Boolean)
	deleteSkill(@CurrentClinic() clinic: Clinic, @Args('input') input: DeleteSkillInput): Promise<boolean> {
		return this.authoring.delete(clinic, input);
	}
}
