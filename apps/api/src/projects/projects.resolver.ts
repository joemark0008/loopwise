import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import type { AuthUser } from '../auth/auth.service.js';
import { ProjectAccess, ProjectAdmin } from '../common/decorators/access.decorator.js';
import { CurrentProject, CurrentUser, SelectedProjectId } from '../common/decorators/current.decorator.js';
import type { Project } from '../generated/prisma/client.js';
import {
	CreateProjectInput,
	RenameProjectInput,
	SavedPromptInput,
	UpdateSavedPromptInput,
} from './dto/project.input.js';
import { DatabaseObject, ProjectSummary, SavedPrompt } from './models/project.model.js';
import { ProjectsService } from './projects.service.js';

@Resolver(() => ProjectSummary)
export class ProjectsResolver {
	constructor(private readonly projectsService: ProjectsService) {}

	@Query(() => [ProjectSummary], { description: 'Projects the signed-in user can access.' })
	projects(@CurrentUser() user: AuthUser): Promise<ProjectSummary[]> {
		return this.projectsService.listForUser(user.id);
	}

	@Query(() => ProjectSummary, { nullable: true, description: 'The selected project (`x-quarry-project-id`).' })
	currentProject(
		@CurrentUser() user: AuthUser,
		@SelectedProjectId() selectedProjectId: string | null,
	): Promise<ProjectSummary | null> {
		return this.projectsService.getCurrent(user.id, selectedProjectId);
	}

	@Mutation(() => ProjectSummary)
	createProject(@CurrentUser() user: AuthUser, @Args('input') input: CreateProjectInput): Promise<ProjectSummary> {
		return this.projectsService.createProject(user.id, input.name);
	}

	@ProjectAdmin()
	@Mutation(() => ProjectSummary)
	renameProject(
		@CurrentProject() project: Project,
		@Args('input') input: RenameProjectInput,
	): Promise<ProjectSummary> {
		return this.projectsService.renameProject(project, input.projectId, input.name);
	}

	@ProjectAdmin()
	@Mutation(() => Boolean)
	async deleteProject(
		@CurrentProject() project: Project,
		@Args('projectId', { type: () => ID }) _projectId: string,
	): Promise<boolean> {
		await this.projectsService.deleteProject(project);
		return true;
	}

	@ProjectAccess()
	@Query(() => [SavedPrompt])
	savedPrompts(@CurrentProject() project: Project): Promise<SavedPrompt[]> {
		return this.projectsService.listSavedPrompts(project.id);
	}

	@Query(() => [SavedPrompt], { description: "A project's saved prompts; empty when the user is not in it." })
	projectSavedPrompts(
		@CurrentUser() user: AuthUser,
		@Args('projectId', { type: () => ID }) projectId: string,
	): Promise<SavedPrompt[]> {
		return this.projectsService.listProjectSavedPromptsForUser(projectId, user.id);
	}

	@ProjectAdmin()
	@Mutation(() => SavedPrompt)
	createSavedPrompt(
		@CurrentProject() project: Project,
		@Args('input') input: SavedPromptInput,
	): Promise<SavedPrompt> {
		return this.projectsService.createSavedPrompt(project.id, input.title, input.prompt);
	}

	@ProjectAdmin()
	@Mutation(() => SavedPrompt)
	updateSavedPrompt(
		@CurrentProject() project: Project,
		@Args('input') input: UpdateSavedPromptInput,
	): Promise<SavedPrompt> {
		return this.projectsService.updateSavedPrompt(project.id, input.promptId, {
			title: input.title,
			prompt: input.prompt,
		});
	}

	@ProjectAdmin()
	@Mutation(() => Boolean)
	async deleteSavedPrompt(
		@CurrentProject() project: Project,
		@Args('promptId', { type: () => ID }) promptId: string,
	): Promise<boolean> {
		await this.projectsService.deleteSavedPrompt(project.id, promptId);
		return true;
	}

	@ProjectAccess()
	@Query(() => [DatabaseObject], { description: 'Synced warehouse tables of the selected project (`@` mentions).' })
	databaseObjects(@CurrentProject() project: Project): DatabaseObject[] {
		return this.projectsService.listDatabaseObjects(project);
	}

	@ProjectAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `project.getDisplaySettings`: the date format.' })
	displaySettings(@CurrentProject() project: Project) {
		return this.projectsService.getDisplaySettings(project.id);
	}

	@ProjectAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `project.updateDisplaySettings`.' })
	updateDisplaySettings(
		@CurrentProject() project: Project,
		@Args('input', { type: () => GraphQLJSON }) input: unknown,
	) {
		return this.projectsService.updateDisplaySettings(project.id, input);
	}
}
