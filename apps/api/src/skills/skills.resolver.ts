import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { isSkillGranted } from '@quarry/shared';

import { fullProjectContextAccess } from '../agent/services/user-group-context-access.service.js';
import { ProjectAccess } from '../common/decorators/access.decorator.js';
import { CurrentProject } from '../common/decorators/current.decorator.js';
import type { Project } from '../generated/prisma/client.js';
import { ProjectContextAdmin } from './context-admin.decorator.js';
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

	@ProjectAccess()
	@Query(() => [Skill], { description: 'The project skills the signed-in user may use (the `/` picker).' })
	async skills(@CurrentProject() project: Project): Promise<Skill[]> {
		await this.skillService.initializeSkills(project.id);
		const { skillsAccess } = fullProjectContextAccess();
		return this.skillService.getSkills(project.id).filter((skill) => isSkillGranted(skillsAccess, skill.name));
	}

	@ProjectContextAdmin()
	@Query(() => [Skill], { description: 'Every project skill, for the admin settings.' })
	async skillCatalog(@CurrentProject() project: Project): Promise<Skill[]> {
		await this.skillService.initializeSkills(project.id);
		return this.skillService.getSkills(project.id);
	}

	@ProjectContextAdmin()
	@Query(() => [SkillLoadError])
	async skillLoadErrors(@CurrentProject() project: Project): Promise<SkillLoadError[]> {
		await this.skillService.initializeSkills(project.id);
		return this.skillService.getSkillLoadErrors(project.id);
	}

	@ProjectContextAdmin()
	@Query(() => SkillSaveStatus)
	skillSaveStatus(@CurrentProject() project: Project): SkillSaveStatus {
		return this.authoring.getSaveStatus(project);
	}

	@ProjectContextAdmin()
	@Query(() => SkillDetail)
	skillDetail(@CurrentProject() project: Project, @Args('name') name: string): Promise<SkillDetail> {
		return this.authoring.getDetail(project, name);
	}

	@ProjectContextAdmin()
	@Mutation(() => CreatedSkill)
	createSkill(@CurrentProject() project: Project, @Args('input') input: CreateSkillInput): Promise<CreatedSkill> {
		return this.authoring.create(project, input);
	}

	@ProjectContextAdmin()
	@Mutation(() => UpdatedSkill)
	updateSkill(@CurrentProject() project: Project, @Args('input') input: UpdateSkillInput): Promise<UpdatedSkill> {
		return this.authoring.update(project, input);
	}

	@ProjectContextAdmin()
	@Mutation(() => Boolean)
	deleteSkill(@CurrentProject() project: Project, @Args('input') input: DeleteSkillInput): Promise<boolean> {
		return this.authoring.delete(project, input);
	}
}
