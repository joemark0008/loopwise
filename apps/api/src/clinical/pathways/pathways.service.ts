import { parsePathwayDefinition, type PathwayDefinition } from '@loopwise/shared/pathway-rules';
import { Injectable } from '@nestjs/common';

import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { PathwayRepository } from './pathway.repository.js';

/** How long a load of the pathways is reused. Short: an edited pathway takes effect within a minute. */
const CACHE_MS = 60_000;

/**
 * The active pathways, validated against `@loopwise/shared/pathway-rules` (DESIGN.md §7). Read as system work, since the
 * rules engine runs for the hub, and cached; a row that fails validation fails the load loudly rather than letting the
 * engine run on half a rule set.
 */
@Injectable()
export class PathwaysService {
	private cache: { at: number; pathways: Promise<PathwayDefinition[]> } | null = null;

	constructor(
		private readonly db: ClinicalDbService,
		private readonly repository: PathwayRepository,
	) {}

	active(now = Date.now()): Promise<PathwayDefinition[]> {
		if (!this.cache || now - this.cache.at >= CACHE_MS) {
			const pathways = this.db.asSystem((tx) => this.repository.listActive(tx)).then((rows) => rows.map(load));
			// A failed load is not cached: the next call tries again.
			pathways.catch(() => (this.cache = null));
			this.cache = { at: now, pathways };
		}
		return this.cache.pathways;
	}

	/** Drops the cache, e.g. after a pathway changes. */
	invalidate(): void {
		this.cache = null;
	}

	/** The active pathways as the user sees them (row-level security: every signed-in user may read pathways). */
	async listForUser(userId: string): Promise<PathwayDefinition[]> {
		const rows = await this.db.asUser(userId, (tx) => this.repository.listActive(tx));
		return rows.map(load);
	}
}

function load(row: {
	key: string;
	name: string;
	version: number;
	rules: unknown;
	steps: unknown;
	slas: unknown;
	closureRequirements: unknown;
}) {
	const { key, name, version, rules, steps, slas, closureRequirements } = row;
	return parsePathwayDefinition({ key, name, version, rules, steps, slas, closureRequirements });
}
