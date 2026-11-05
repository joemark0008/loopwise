import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs')>();
	return { ...actual, watch: vi.fn(() => ({ close: vi.fn() })) };
});

import type { ClinicRepository } from '../clinics/clinic.repository.js';
import type { ConfigService } from '../config/config.service.js';
import type { Clinic } from '../generated/prisma/client.js';
import { SkillService } from './skill.service.js';
import { SkillAuthoringService } from './skill-authoring.service.js';

const DRAFT = {
	name: 'churn-analysis',
	description: 'Use when: asked about churn #retention',
	body: '1. Do the thing.',
};

describe('SkillAuthoringService', () => {
	let root: string;
	let clinic: Clinic;
	let authoringEnv: 'auto' | 'off';
	let skills: SkillService;
	let authoring: SkillAuthoringService;
	const skillFile = (name = DRAFT.name) => join(root, 'agent', 'skills', `${name}.md`);

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'loopwise-skill-authoring-'));
		clinic = { id: `clinic-${root}`, path: root } as Clinic;
		authoringEnv = 'auto';
		skills = new SkillService({
			getClinicById: vi.fn(async () => clinic),
		} as unknown as ClinicRepository);
		authoring = new SkillAuthoringService(skills, {
			get env() {
				return { LOOPWISE_SKILL_AUTHORING: authoringEnv };
			},
		} as unknown as ConfigService);
	});

	afterEach(() => {
		skills.onModuleDestroy();
		chmodSync(root, 0o755);
		rmSync(root, { recursive: true, force: true });
	});

	describe('create', () => {
		it('writes the file, creating the folder, and the skill is usable at once', async () => {
			await skills.initializeSkills(clinic.id);
			expect(skills.getSkills(clinic.id)).toEqual([]);

			const created = await authoring.create(clinic, DRAFT);

			expect(created).toEqual({ name: DRAFT.name, location: '/agent/skills/churn-analysis.md' });
			expect(skills.getSkill(clinic.id, DRAFT.name)?.description).toBe(DRAFT.description);
			expect(skills.getSkillBody(clinic.id, DRAFT.name)).toBe(DRAFT.body);
		});

		it('keeps YAML special characters in the description', async () => {
			await authoring.create(clinic, DRAFT);
			expect(matter(readFileSync(skillFile(), 'utf8')).data.description).toBe(DRAFT.description);
		});

		it.each([
			['an invalid name', { ...DRAFT, name: '../../etc/passwd' }],
			['an uppercase name', { ...DRAFT, name: 'Churn' }],
			['an empty description', { ...DRAFT, description: '  ' }],
			['an empty body', { ...DRAFT, body: '' }],
		])('rejects %s', async (_label, draft) => {
			await expect(authoring.create(clinic, draft)).rejects.toMatchObject({ codeMessage: 'BAD_REQUEST' });
			expect(existsSync(join(root, 'agent'))).toBe(false);
		});

		it('rejects the name of a built-in skill', async () => {
			await expect(authoring.create(clinic, { ...DRAFT, name: 'skill-creator' })).rejects.toMatchObject({
				codeMessage: 'CONFLICT',
			});
		});

		it('never replaces an existing skill, even one with another file name', async () => {
			await authoring.create(clinic, DRAFT);
			await expect(authoring.create(clinic, DRAFT)).rejects.toMatchObject({ codeMessage: 'CONFLICT' });

			writeFileSync(skillFile('other-file'), '---\nname: taken\ndescription: d\n---\nbody');
			skills.reloadSkills(clinic.id);
			await expect(authoring.create(clinic, { ...DRAFT, name: 'taken' })).rejects.toMatchObject({
				codeMessage: 'CONFLICT',
			});
		});

		it('never replaces a file that exists but is not in the catalog', async () => {
			mkdirSync(join(root, 'agent', 'skills'), { recursive: true });
			await skills.initializeSkills(clinic.id);
			writeFileSync(skillFile(), 'hand-written');
			await expect(authoring.create(clinic, DRAFT)).rejects.toMatchObject({ codeMessage: 'CONFLICT' });
			expect(readFileSync(skillFile(), 'utf8')).toBe('hand-written');
		});

		it('refuses to write through a symlinked folder', async () => {
			const outside = mkdtempSync(join(tmpdir(), 'loopwise-skill-outside-'));
			mkdirSync(join(root, 'agent'));
			symlinkSync(outside, join(root, 'agent', 'skills'));

			await expect(authoring.create(clinic, DRAFT)).rejects.toMatchObject({ codeMessage: 'FORBIDDEN' });
			expect(existsSync(join(outside, 'churn-analysis.md'))).toBe(false);
			rmSync(outside, { recursive: true, force: true });
		});

		// root ignores file permissions, as in a CI container.
		it.skipIf(process.getuid?.() === 0)('reports a read-only folder without the server path', async () => {
			chmodSync(root, 0o555);
			const error = (await authoring.create(clinic, DRAFT).catch((caught) => caught)) as Error;
			expect(error.message).toContain('could not write');
			expect(error.message).not.toContain(root);
		});

		it('is blocked when the deployment turned authoring off', async () => {
			authoringEnv = 'off';
			await expect(authoring.create(clinic, DRAFT)).rejects.toMatchObject({ codeMessage: 'FORBIDDEN' });
			expect(authoring.getSaveStatus(clinic)).toMatchObject({ mode: 'disabled' });
			expect(existsSync(skillFile())).toBe(false);
		});
	});

	describe('update and delete', () => {
		beforeEach(async () => {
			await authoring.create(clinic, DRAFT);
		});

		it('updates the skill and keeps other front matter', async () => {
			const raw = readFileSync(skillFile(), 'utf8').replace('---\n', '---\nowner: data-team\n');
			writeFileSync(skillFile(), raw);
			const { hash } = await authoring.getDetail(clinic, DRAFT.name);

			await authoring.update(clinic, {
				...DRAFT,
				description: 'New',
				body: 'New body',
				expectedHash: hash,
			});

			const { data, content } = matter(readFileSync(skillFile(), 'utf8'));
			expect(data).toEqual({ owner: 'data-team', name: DRAFT.name, description: 'New' });
			expect(content.trim()).toBe('New body');
			expect(skills.getSkill(clinic.id, DRAFT.name)?.description).toBe('New');
		});

		it('refuses an edit based on an older version', async () => {
			await expect(authoring.update(clinic, { ...DRAFT, expectedHash: 'a'.repeat(64) })).rejects.toMatchObject({
				codeMessage: 'CONFLICT',
			});
		});

		it('deletes the skill', async () => {
			const { hash } = await authoring.getDetail(clinic, DRAFT.name);
			await authoring.delete(clinic, { name: DRAFT.name, expectedHash: hash });
			expect(existsSync(skillFile())).toBe(false);
			expect(skills.getSkills(clinic.id)).toEqual([]);
		});

		it('refuses a delete based on an older version', async () => {
			await expect(
				authoring.delete(clinic, { name: DRAFT.name, expectedHash: 'a'.repeat(64) }),
			).rejects.toMatchObject({ codeMessage: 'CONFLICT' });
			expect(existsSync(skillFile())).toBe(true);
		});

		it('reports an unknown skill', async () => {
			await expect(authoring.getDetail(clinic, 'missing')).rejects.toMatchObject({ codeMessage: 'NOT_FOUND' });
		});
	});

	describe('SkillService freshness', () => {
		it('picks up a folder and file that appear after the first load, once the load is old', async () => {
			await skills.initializeSkills(clinic.id);
			mkdirSync(join(root, 'agent', 'skills'), { recursive: true });
			writeFileSync(skillFile('late'), '---\nname: late\ndescription: d\n---\nbody');

			await skills.initializeSkills(clinic.id);
			expect(skills.getSkills(clinic.id)).toEqual([]);

			const now = Date.now();
			const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 6_000);
			await skills.initializeSkills(clinic.id);
			clock.mockRestore();
			expect(skills.getSkills(clinic.id).map((skill) => skill.name)).toEqual(['late']);
		});
	});
});
