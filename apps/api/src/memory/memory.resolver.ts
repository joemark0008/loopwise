import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../auth/auth.service.js';
import { ProjectAccess } from '../common/decorators/access.decorator.js';
import { CurrentProject, CurrentUser } from '../common/decorators/current.decorator.js';
import { HandlerError } from '../common/errors/handler-error.js';
import type { Project } from '../generated/prisma/client.js';
import { EditMemoryInput } from './dto/memory.input.js';
import { MemoryService } from './memory.service.js';
import { Memory, MemorySettings } from './models/memory.model.js';

/** Settings → Memory: upstream tRPC `memory.*`, `user.getMemories`, `user.getMemorySettings`, `project.getMemorySettings`. */
@Resolver(() => Memory)
export class MemoryResolver {
	constructor(private readonly memory: MemoryService) {}

	@Query(() => [Memory], { description: "The signed-in user's active memories." })
	memories(@CurrentUser() user: AuthUser): Promise<Memory[]> {
		return this.memory.listUserMemories(user.id);
	}

	@Query(() => MemorySettings, { description: 'Whether the signed-in user has memory turned on.' })
	async memorySettings(@CurrentUser() user: AuthUser): Promise<MemorySettings> {
		return { memoryEnabled: await this.memory.isUserMemoryEnabled(user.id) };
	}

	@ProjectAccess()
	@Query(() => MemorySettings, { description: 'Whether the project allows memory (admin agent setting).' })
	async projectMemorySettings(@CurrentProject() project: Project): Promise<MemorySettings> {
		return { memoryEnabled: await this.memory.isProjectMemoryEnabled(project.id) };
	}

	@ProjectAccess()
	@Mutation(() => MemorySettings)
	async setMemoryEnabled(
		@CurrentUser() user: AuthUser,
		@Args('memoryEnabled') memoryEnabled: boolean,
	): Promise<MemorySettings> {
		await this.memory.setEnabled(user.id, memoryEnabled);
		return { memoryEnabled };
	}

	@ProjectAccess()
	@Mutation(() => Memory)
	async editMemory(@CurrentUser() user: AuthUser, @Args('input') input: EditMemoryInput): Promise<Memory> {
		const content = this.memory.normalizeMemoryContent(input.content);
		if (!content) {
			throw new HandlerError('BAD_REQUEST', 'Memory content cannot be empty.');
		}
		const updated = await this.memory.updateContent(user.id, input.memoryId, content);
		if (!updated) {
			throw new HandlerError('NOT_FOUND', 'Memory not found.');
		}
		return updated;
	}

	@ProjectAccess()
	@Mutation(() => Boolean)
	async deleteMemory(
		@CurrentUser() user: AuthUser,
		@Args('memoryId', { type: () => ID }) memoryId: string,
	): Promise<boolean> {
		const deleted = await this.memory.delete(user.id, memoryId);
		if (!deleted) {
			throw new HandlerError('NOT_FOUND', 'Memory not found.');
		}
		return true;
	}
}
