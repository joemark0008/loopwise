import type { LlmProvider } from '@loopwise/shared/types';
import { z } from 'zod/v4';

import type { UIMessage } from './chat.js';

/** Categories of memories that can be extracted from user messages. Ordered by priority. */
export const MEMORY_CATEGORIES = ['global_rule', 'personal_fact'] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface UserMemory {
	category: MemoryCategory;
	content: string;
}

/** A row of the `memories` table (upstream `DBMemory`). */
export interface MemoryRecord {
	id: string;
	userId: string;
	chatId: string | null;
	content: string;
	category: MemoryCategory;
	supersededBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewMemoryRecord {
	userId: string;
	chatId: string;
	content: string;
	category: MemoryCategory;
	supersedesId?: string | null;
}

export interface MemoryExtractionOptions {
	userId: string;
	clinicId: string;
	chatId: string;
	messages: UIMessage[];
	provider: LlmProvider;
	modelId: string;
}

export type UserMemoryRecord = Omit<MemoryRecord, 'userId' | 'chatId'>;

export type UserInstruction = z.infer<typeof UserInstructionSchema>;
const UserInstructionSchema = z.object({
	content: z
		.string()
		.trim()
		.min(1)
		.describe(
			'The user instructions to be persisted. Must be a direct directive to the agent (e.g. "Do ...", "Do not ...", "Always ...", "Never ...", etc).',
		),
	supersedes_id: z
		.string()
		.nullable()
		.describe("The id of an existing user instruction's memory that this one supersedes."),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
const UserProfileSchema = z.object({
	content: z
		.string()
		.trim()
		.min(1)
		.describe(
			'The user profile to be persisted. Must be a concise statement about the user (e.g. "The user\'s name is ...", "The user works as a ...").',
		),
	supersedes_id: z
		.string()
		.nullable()
		.describe("The id of an existing user profile's memory that this one supersedes."),
});

export type ExtractorLLMOutput = z.infer<typeof ExtractorOutputSchema>;
export const ExtractorOutputSchema = z.object({
	user_instructions: z.array(UserInstructionSchema).nullable(),
	user_profile: z.array(UserProfileSchema).nullable(),
});
