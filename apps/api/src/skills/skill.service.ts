import { existsSync, readdirSync, readFileSync, realpathSync, statSync, watch } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

import { debounce } from '@loopwise/shared';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import matter from 'gray-matter';

import { truncateMiddle } from '../agent/utils/utils.js';
import { ClinicRepository } from '../clinics/clinic.repository.js';

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

interface ClinicSkills {
	clinicPath: string;
	skillsFolderPath: string;
	skills: Skill[];
	loadErrors: SkillLoadError[];
	fileWatcher: ReturnType<typeof watch> | null;
	loadedAt: number;
	debouncedReload: () => void;
}

type SkillReadResult = { skill: Skill } | { loadError: SkillLoadError };

/**
 * Port of upstream `services/skill.ts`: clinic skills are the Markdown files of `agent/skills/` (front matter
 * `name`/`description`), loaded once per clinic and reloaded by a file watcher. Editing them happens in the
 * context explorer; this service only reads them.
 */
@Injectable()
export class SkillService implements OnModuleDestroy {
	constructor(private readonly clinics: ClinicRepository) {}

	private _projects = new Map<string, ClinicSkills>();
	private _initPromises = new Map<string, Promise<void>>();

	public async initializeSkills(clinicId: string): Promise<void> {
		const known = this._projects.get(clinicId);
		if (known) {
			if (Date.now() - known.loadedAt > RELOAD_AFTER_MS) {
				this.reloadSkills(clinicId);
			}
			return;
		}

		let initPromise = this._initPromises.get(clinicId);
		if (!initPromise) {
			initPromise = this._initialize(clinicId).catch((err) => {
				this._initPromises.delete(clinicId);
				throw err;
			});
			this._initPromises.set(clinicId, initPromise);
		}

		return initPromise;
	}

	/** Reads the skills folder now, and starts watching it if it only appeared after the first load. */
	public reloadSkills(clinicId: string): void {
		this._loadSkills(clinicId);
		if (!this._projects.get(clinicId)?.fileWatcher) {
			this._setupFileWatcher(clinicId);
		}
	}

	public getSkills(clinicId: string): Skill[] {
		return this._projects.get(clinicId)?.skills ?? [];
	}

	public getSkill(clinicId: string, skillName: string): Skill | undefined {
		return this.getSkills(clinicId).find((skill) => skill.name === skillName.trim());
	}

	public getSkillLoadErrors(clinicId: string): SkillLoadError[] {
		return this._projects.get(clinicId)?.loadErrors ?? [];
	}

	public getSkillContent(clinicId: string, skillName: string): string | null {
		const entry = this._projects.get(clinicId);
		if (!entry) {
			return null;
		}

		const skill = entry.skills.find((s) => s.name === skillName);
		if (!skill) {
			return null;
		}

		const realFilePath = this._resolveSkillFile(entry, join(entry.clinicPath, skill.location));
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

	public getSkillBody(clinicId: string, skillName: string): string | null {
		const rawContent = this.getSkillContent(clinicId, skillName);
		if (!rawContent) {
			return null;
		}
		return matter(rawContent).content.trim() || null;
	}

	/**
	 * Preloaded skills ride along in every request, so the set is capped: each skill body is truncated,
	 * then skills are taken in the order the operator listed them, skipping any that no longer fit the total budget.
	 */
	public getPreloadedSkills(clinicId: string, names: string[] = []): PreloadedSkill[] {
		const preloaded: PreloadedSkill[] = [];
		const dropped: string[] = [];
		let totalChars = 0;

		for (const skill of this._findSkillsByName(clinicId, names)) {
			const body = this.getSkillBody(clinicId, skill.name);
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

	private _findSkillsByName(clinicId: string, names: string[]): Skill[] {
		const skills = this.getSkills(clinicId);
		return [...new Set(names)]
			.map((name) => skills.find((skill) => skill.name === name))
			.filter((skill): skill is Skill => skill !== undefined);
	}

	private async _initialize(clinicId: string): Promise<void> {
		const clinic = await this.clinics.getClinicById(clinicId);
		const clinicPath = clinic?.path || '';
		const skillsFolderPath = join(clinicPath, 'agent', 'skills');

		this._projects.set(clinicId, {
			clinicPath,
			skillsFolderPath,
			skills: [],
			loadErrors: [],
			fileWatcher: null,
			loadedAt: 0,
			debouncedReload: debounce(() => this._loadSkills(clinicId), 2000),
		});

		this._loadSkills(clinicId);
		this._setupFileWatcher(clinicId);
	}

	private _loadSkills(clinicId: string): void {
		const entry = this._projects.get(clinicId);
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
			this._readSkills(clinicId, files);
		} catch (error) {
			logger.error(`Failed to load skills: ${String(error)}`);
			entry.skills = [];
			entry.loadErrors = [{ location: SKILLS_FOLDER_LOCATION, message: toLoadErrorMessage(error, entry) }];
		}
	}

	private _readSkills(clinicId: string, files: string[]): void {
		const entry = this._projects.get(clinicId);
		if (!entry) {
			return;
		}

		const results = files.flatMap((file) => this._readSkill(entry, file) ?? []);
		const skills = results.flatMap((result) => ('skill' in result ? [result.skill] : []));
		entry.skills = dropDuplicateSkillNames(skills);
		entry.loadErrors = results.flatMap((result) => ('loadError' in result ? [result.loadError] : []));
	}

	private _readSkill(entry: ClinicSkills, file: string): SkillReadResult | null {
		const filePath = join(entry.skillsFolderPath, file);
		const location = '/' + relative(entry.clinicPath, filePath);
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
	 * so only files that really live in the skills folder inside the clinic are read.
	 */
	private _resolveSkillFile(entry: ClinicSkills, filePath: string): string | null {
		try {
			const realFilePath = realpathSync(filePath);
			const isInsideClinic = isWithinDirectory(realpathSync(entry.clinicPath), realFilePath);
			const isInsideSkillsFolder = isWithinDirectory(realpathSync(entry.skillsFolderPath), realFilePath);
			if (isInsideClinic && isInsideSkillsFolder && statSync(realFilePath).isFile()) {
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

	private _setupFileWatcher(clinicId: string): void {
		const entry = this._projects.get(clinicId);
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
 * Filesystem errors quote the absolute path, which clinic members must not see, so the clinic root is masked.
 */
function toLoadErrorMessage(error: unknown, entry: ClinicSkills): string {
	const message = error instanceof Error ? error.message : String(error);
	const firstLine = message.split('\n')[0].trim();
	return maskClinicPath(firstLine, entry.clinicPath);
}

function maskClinicPath(message: string, clinicPath: string): string {
	const roots = new Set([clinicPath, safeRealpath(clinicPath)].filter((root) => root.length > 0));
	return [...roots].reduce((masked, root) => masked.replaceAll(root, '<clinic>'), message);
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
