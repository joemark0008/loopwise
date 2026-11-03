import { Injectable } from '@nestjs/common';
import type { SkillDraft, SkillSaveMode } from '@quarry/shared/skill-authoring';
import { SkillDraftSchema, skillFilePath } from '@quarry/shared/skill-authoring';
import matter from 'gray-matter';

import { findInternalSkill } from '../agent/skills/index.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { ConfigService } from '../config/config.service.js';
import type { Project } from '../generated/prisma/client.js';
import { createContextFile, hashContent, overwriteContextFile, removeContextFile } from './files/context-files.js';
import { SkillService } from './skill.service.js';

const DISABLED_MESSAGE = 'This deployment manages skills as files, so they cannot be edited in the app.';

type SkillWriteTarget = { mode: 'direct'; root: string } | { mode: 'disabled'; message: string };

/** Writing project skills from the app. The Markdown file in the project folder stays the source of truth. */
@Injectable()
export class SkillAuthoringService {
	constructor(
		private readonly skills: SkillService,
		private readonly config: ConfigService,
	) {}

	getSaveStatus(project: Project): { mode: SkillSaveMode; message: string | null } {
		const target = this.resolveTarget(project);
		return { mode: target.mode, message: 'message' in target ? target.message : null };
	}

	async getDetail(project: Project, name: string) {
		await this.skills.initializeSkills(project.id);
		const { rawContent, skill } = this.readSkill(project.id, name);
		const { data, content } = matter(rawContent);
		return {
			name: skill.name,
			description: typeof data.description === 'string' ? data.description : '',
			body: content.trim(),
			hash: hashContent(Buffer.from(rawContent)),
		};
	}

	async create(project: Project, input: SkillDraft) {
		const draft = parseDraft(input);
		const root = this.requireRoot(project);
		await this.skills.initializeSkills(project.id);
		if (findInternalSkill(draft.name) || this.skills.getSkill(project.id, draft.name)) {
			throw new HandlerError('CONFLICT', `A skill called '${draft.name}' already exists.`);
		}

		const location = skillFilePath(draft.name);
		createContextFile(location, renderSkillFile(draft), root);
		this.skills.reloadSkills(project.id);
		return { name: draft.name, location };
	}

	async update(project: Project, input: SkillDraft & { expectedHash: string }) {
		const root = this.requireRoot(project);
		await this.skills.initializeSkills(project.id);
		const { rawContent, skill } = this.readSkill(project.id, input.name);
		// The name stays as it is, even a hand-written one the builder wouldn't accept for a new skill.
		const { description, body } = SkillDraftSchema.pick({ description: true, body: true }).parse(input);
		const hash = overwriteContextFile(
			skill.location,
			matter.stringify(body, { ...matter(rawContent).data, name: skill.name, description }),
			input.expectedHash,
			root,
		);
		this.skills.reloadSkills(project.id);
		return { name: skill.name, hash };
	}

	async delete(project: Project, input: { name: string; expectedHash: string }): Promise<boolean> {
		const root = this.requireRoot(project);
		await this.skills.initializeSkills(project.id);
		const { skill } = this.readSkill(project.id, input.name);
		removeContextFile(skill.location, input.expectedHash, root);
		this.skills.reloadSkills(project.id);
		return true;
	}

	private resolveTarget(project: Project): SkillWriteTarget {
		if (this.config.env.QUARRY_SKILL_AUTHORING === 'off') {
			return { mode: 'disabled', message: DISABLED_MESSAGE };
		}
		if (!project.path) {
			throw new HandlerError('BAD_REQUEST', 'No project path configured.');
		}
		return { mode: 'direct', root: project.path };
	}

	private requireRoot(project: Project): string {
		const target = this.resolveTarget(project);
		if (target.mode === 'disabled') {
			throw new HandlerError('FORBIDDEN', target.message);
		}
		return target.root;
	}

	private readSkill(projectId: string, name: string) {
		const skill = this.skills.getSkill(projectId, name);
		const rawContent = skill && this.skills.getSkillContent(projectId, skill.name);
		if (!skill || !rawContent) {
			throw new HandlerError('NOT_FOUND', `There is no skill called '${name}'.`);
		}
		return { skill, rawContent };
	}
}

function parseDraft(input: SkillDraft): SkillDraft {
	const parsed = SkillDraftSchema.safeParse(input);
	if (!parsed.success) {
		throw new HandlerError('BAD_REQUEST', parsed.error.issues[0]?.message ?? 'Invalid skill.');
	}
	return parsed.data;
}

function renderSkillFile({ name, description, body }: SkillDraft): string {
	return matter.stringify(body, { name, description });
}
