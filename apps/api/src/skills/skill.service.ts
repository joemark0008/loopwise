import { existsSync, readdirSync, readFileSync, realpathSync, statSync, watch } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { debounce } from '@quarry/shared';
import matter from 'gray-matter';

import { truncateMiddle } from '../agent/utils/utils.js';
import { ProjectRepository } from '../projects/project.repository.js';

const logger = new Logger('SkillService');

export interface Skill {
	name: string;
	description: string;
	location: string;
}

export interface PreloadedSkill extends Skill {
	content: string;
}

export interface SkillLoadError {
	location: string;
	message: string;
}

export const PRELOADED_SKILL_CHAR_LIMIT = 8_000;
export const PRELOADED_SKILLS_TOTAL_CHAR_LIMIT = 24_000;

const SKILLS_FOLDER_LOCATION = '/agent/skills';
/** How long a load stays fresh without a watch event, which network volumes and other replicas never get. */
const RELOAD_AFTER_MS = 5_000;

interface ProjectSkills {
	projectPath: string;
	skillsFolderPath: string;
	skills: Skill[];
	loadErrors: SkillLoadError[];
	fileWatcher: ReturnType<typeof watch> | null;
	loadedAt: number;
	debouncedReload: () => void;
}

type SkillReadResult = { skill: Skill } | { loadError: SkillLoadError };

/**
 * Port of upstream `services/skill.ts`: project skills are the Markdown files of `agent/skills/` (front matter
 * `name`/`description`), loaded once per project and reloaded by a file watcher. Editing them happens in the
 * context explorer; this service only reads them.
 */
@Injectable()
export class SkillService implements OnModuleDestroy {
	constructor(private readonly projects: ProjectRepository) {}

	private _projects = new Map<string, ProjectSkills>();
	private _initPromises = new Map<string, Promise<void>>();

	public async initializeSkills(projectId: string): Promise<void> {
		const known = this._projects.get(projectId);
		if (known) {
			if (Date.now() - known.loadedAt > RELOAD_AFTER_MS) {
				this.reloadSkills(projectId);
			}
			return;
		}

		let initPromise = this._initPromises.get(projectId);
		if (!initPromise) {
			initPromise = this._initialize(projectId).catch((err) => {
				this._initPromises.delete(projectId);
				throw err;
			});
			this._initPromises.set(projectId, initPromise);
		}

		return initPromise;
	}

	/** Reads the skills folder now, and starts watching it if it only appeared after the first load. */
	public reloadSkills(projectId: string): void {
		this._loadSkills(projectId);
		if (!this._projects.get(projectId)?.fileWatcher) {
			this._setupFileWatcher(projectId);
		}
	}

	public getSkills(projectId: string): Skill[] {
		return this._projects.get(projectId)?.skills ?? [];
	}

	public getSkill(projectId: string, skillName: string): Skill | undefined {
		return this.getSkills(projectId).find((skill) => skill.name === skillName.trim());
	}

	public getSkillLoadErrors(projectId: string): SkillLoadError[] {
		return this._projects.get(projectId)?.loadErrors ?? [];
	}

	public getSkillContent(projectId: string, skillName: string): string | null {
		const entry = this._projects.get(projectId);
		if (!entry) {
			return null;
		}

		const skill = entry.skills.find((s) => s.name === skillName);
		if (!skill) {
			return null;
		}

		const realFilePath = this._resolveSkillFile(entry, join(entry.projectPath, skill.location));
		if (!realFilePath) {
			return null;
		}

		try {
			return readFileSync(realFilePath, 'utf8');
		} catch (error) {
			logger.error(`Failed to read skill content for ${skillName}: ${String(error)}`);
			return null;
		}
	}

	public getSkillBody(projectId: string, skillName: string): string | null {
		const rawContent = this.getSkillContent(projectId, skillName);
		if (!rawContent) {
			return null;
		}
		return matter(rawContent).content.trim() || null;
	}

	/**
	 * Preloaded skills ride along in every request, so the set is capped: each skill body is truncated,
	 * then skills are taken in the order the operator listed them, skipping any that no longer fit the total budget.
	 */
	public getPreloadedSkills(projectId: string, names: string[] = []): PreloadedSkill[] {
		const preloaded: PreloadedSkill[] = [];
		const dropped: string[] = [];
		let totalChars = 0;

		for (const skill of this._findSkillsByName(projectId, names)) {
			const body = this.getSkillBody(projectId, skill.name);
			if (!body) {
				continue;
			}

			const content = truncateMiddle(body, PRELOADED_SKILL_CHAR_LIMIT);
			if (totalChars + content.length > PRELOADED_SKILLS_TOTAL_CHAR_LIMIT) {
				dropped.push(skill.name);
				continue;
			}

			totalChars += content.length;
			preloaded.push({ ...skill, content });
		}

		if (dropped.length > 0) {
			logger.warn(
				`Preloaded skills over the ${PRELOADED_SKILLS_TOTAL_CHAR_LIMIT} character budget were skipped: ${dropped.join(', ')}`,
			);
		}

		return preloaded;
	}

	private _findSkillsByName(projectId: string, names: string[]): Skill[] {
		const skills = this.getSkills(projectId);
		return [...new Set(names)]
			.map((name) => skills.find((skill) => skill.name === name))
			.filter((skill): skill is Skill => skill !== undefined);
	}

	private async _initialize(projectId: string): Promise<void> {
		const project = await this.projects.getProjectById(projectId);
		const projectPath = project?.path || '';
		const skillsFolderPath = join(projectPath, 'agent', 'skills');

		this._projects.set(projectId, {
			projectPath,
			skillsFolderPath,
			skills: [],
			loadErrors: [],
			fileWatcher: null,
			loadedAt: 0,
			debouncedReload: debounce(() => this._loadSkills(projectId), 2000),
		});

		this._loadSkills(projectId);
		this._setupFileWatcher(projectId);
	}

	private _loadSkills(projectId: string): void {
		const entry = this._projects.get(projectId);
		if (!entry) {
			return;
		}
		entry.loadedAt = Date.now();

		try {
			if (!existsSync(entry.skillsFolderPath)) {
				logger.debug(`Skills folder not found: ${entry.skillsFolderPath}`);
				entry.skills = [];
				entry.loadErrors = [];
				return;
			}

			if (!statSync(entry.skillsFolderPath).isDirectory()) {
				logger.error(`Skills path is not a directory: ${entry.skillsFolderPath}`);
				entry.skills = [];
				entry.loadErrors = [{ location: SKILLS_FOLDER_LOCATION, message: 'Skills path is not a directory' }];
				return;
			}

			const files = readdirSync(entry.skillsFolderPath).filter((f) => f.endsWith('.md'));
			this._readSkills(projectId, files);
		} catch (error) {
			logger.error(`Failed to load skills: ${String(error)}`);
			entry.skills = [];
			entry.loadErrors = [{ location: SKILLS_FOLDER_LOCATION, message: toLoadErrorMessage(error, entry) }];
		}
	}

	private _readSkills(projectId: string, files: string[]): void {
		const entry = this._projects.get(projectId);
		if (!entry) {
			return;
		}

		const results = files.flatMap((file) => this._readSkill(entry, file) ?? []);
		const skills = results.flatMap((result) => ('skill' in result ? [result.skill] : []));
		entry.skills = dropDuplicateSkillNames(skills);
		entry.loadErrors = results.flatMap((result) => ('loadError' in result ? [result.loadError] : []));
	}

	private _readSkill(entry: ProjectSkills, file: string): SkillReadResult | null {
		const filePath = join(entry.skillsFolderPath, file);
		const location = '/' + relative(entry.projectPath, filePath);
		const realFilePath = this._resolveSkillFile(entry, filePath);
		if (!realFilePath) {
			return null;
		}

		try {
			const { data } = matter(readFileSync(realFilePath, 'utf8'));
			return {
				skill: {
					name: String(data.name || file.replace('.md', '')).trim(),
					description: data.description || '',
					location,
				},
			};
		} catch (error) {
			logger.error(`Ignoring skill file ${filePath}: ${String(error)}`);
			return { loadError: { location, message: toLoadErrorMessage(error, entry) } };
		}
	}

	/**
	 * Skill files, or the skills folder itself, may be symlinks from a synced repo,
	 * so only files that really live in the skills folder inside the project are read.
	 */
	private _resolveSkillFile(entry: ProjectSkills, filePath: string): string | null {
		try {
			const realFilePath = realpathSync(filePath);
			const isInsideProject = isWithinDirectory(realpathSync(entry.projectPath), realFilePath);
			const isInsideSkillsFolder = isWithinDirectory(realpathSync(entry.skillsFolderPath), realFilePath);
			if (isInsideProject && isInsideSkillsFolder && statSync(realFilePath).isFile()) {
				return realFilePath;
			}
			logger.warn(`Ignoring skill file outside the skills folder: ${filePath}`);
			return null;
		} catch (error) {
			logger.error(`Failed to resolve skill file ${filePath}: ${String(error)}`);
			return null;
		}
	}

	onModuleDestroy(): void {
		for (const entry of this._projects.values()) {
			entry.fileWatcher?.close();
		}
	}

	private _setupFileWatcher(projectId: string): void {
		const entry = this._projects.get(projectId);
		if (!entry || !existsSync(entry.skillsFolderPath)) {
			return;
		}

		try {
			entry.fileWatcher = watch(entry.skillsFolderPath, { recursive: true }, (eventType) => {
				if (eventType === 'change' || eventType === 'rename') {
					entry.debouncedReload();
				}
			});
		} catch (error) {
			logger.error(`Skills file watcher setup failed: ${String(error)}`);
		}
	}
}

/** Skills are looked up by name, so a second file claiming a taken name would be unreachable. */
function dropDuplicateSkillNames(skills: Skill[]): Skill[] {
	const seenNames = new Set<string>();
	return skills.filter((skill) => {
		if (seenNames.has(skill.name)) {
			logger.warn(`Ignoring skill ${skill.location}: the name '${skill.name}' is already used`);
			return false;
		}
		seenNames.add(skill.name);
		return true;
	});
}

/**
 * YAML errors append a multi-line excerpt of the file; the first line already carries the reason and position.
 * Filesystem errors quote the absolute path, which project members must not see, so the project root is masked.
 */
function toLoadErrorMessage(error: unknown, entry: ProjectSkills): string {
	const message = error instanceof Error ? error.message : String(error);
	const firstLine = message.split('\n')[0].trim();
	return maskProjectPath(firstLine, entry.projectPath);
}

function maskProjectPath(message: string, projectPath: string): string {
	const roots = new Set([projectPath, safeRealpath(projectPath)].filter((root) => root.length > 0));
	return [...roots].reduce((masked, root) => masked.replaceAll(root, '<project>'), message);
}

function safeRealpath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return '';
	}
}

function isWithinDirectory(directory: string, target: string): boolean {
	const relativePath = relative(directory, target);
	return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}
