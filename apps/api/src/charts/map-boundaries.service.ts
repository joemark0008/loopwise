import { type CustomBoundarySet, resolveBoundary } from '@loopwise/shared';
import { Injectable } from '@nestjs/common';
import type { FeatureCollection } from 'geojson';
import { z } from 'zod/v4';

import { getCachedBoundary, setCachedBoundary } from '../agent/utils/map-boundary-cache.js';
import { parseAndValidateGeoJson, safeFetch } from '../agent/utils/safe-fetch.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { ProjectRepository } from '../projects/project.repository.js';

const boundaryKeySchema = z
	.string()
	.trim()
	.min(1)
	.max(64)
	.regex(/^[a-z0-9_]+$/, 'Key must be lowercase letters, digits, or underscores only.');

export const validateMapBoundaryUrlSchema = z.object({ url: z.url() });

export const addMapBoundarySchema = z.object({
	key: boundaryKeySchema,
	label: z.string().trim().min(1).max(255),
	url: z.url(),
	joinProperty: z.string().trim().min(1).max(255),
	regionKeyHint: z.string().trim().min(1).max(500),
	featureCount: z.number().int().nonnegative().optional(),
});

export const updateMapBoundarySchema = z.object({
	key: z.string().trim().min(1),
	newKey: z
		.string()
		.trim()
		.min(1)
		.max(64)
		.regex(/^[a-z0-9_]+$/)
		.optional(),
	label: z.string().trim().min(1).max(255).optional(),
	url: z.url().optional(),
	joinProperty: z.string().trim().min(1).max(255).optional(),
	regionKeyHint: z.string().trim().min(1).max(500).optional(),
	featureCount: z.number().int().nonnegative().optional(),
});

export const deleteMapBoundarySchema = z.object({ key: z.string().trim().min(1) });

/**
 * Port of upstream `routes/map-boundaries.ts` (GeoJSON served to the map views) and the map-boundary procedures of
 * the tRPC `project` router (Settings → Display → custom boundary sets on `project.map_settings`).
 */
@Injectable()
export class MapBoundariesService {
	constructor(private readonly projects: ProjectRepository) {}

	/** `GET /api/map-boundaries/:projectId/:key`: a built-in or custom boundary set of a project the user is in. */
	async getProjectBoundary(projectId: string, key: string, userId: string): Promise<FeatureCollection> {
		const userRole = await this.projects.getUserRoleInProject(projectId, userId);
		if (!userRole) {
			throw new HandlerError('FORBIDDEN', 'You do not have access to this project.');
		}
		const customSets = await this.projects.getCustomBoundaries(projectId);
		const resolved = resolveBoundary(key, customSets);
		if (!resolved) {
			throw new HandlerError('NOT_FOUND', `Boundary set "${key}" not found.`);
		}
		return this.fetchBoundary(resolved.url);
	}

	/** `GET /api/map-boundaries/proxy?url=`: any public GeoJSON URL, fetched through the SSRF-safe client. */
	async proxyBoundary(url: unknown): Promise<FeatureCollection> {
		if (typeof url !== 'string') {
			throw new HandlerError('BAD_REQUEST', 'url is required');
		}
		return this.fetchBoundary(url);
	}

	getMapBoundaries(projectId: string): Promise<CustomBoundarySet[]> {
		return this.projects.getCustomBoundaries(projectId);
	}

	async validateMapBoundaryUrl(rawInput: unknown) {
		const input = parse(validateMapBoundaryUrlSchema, rawInput);
		// loopwise: upstream lets the fetch error through as a tRPC error carrying its message; here unknown errors
		// are masked, so the reason (unreachable host, invalid GeoJSON…) is reported as a bad request.
		try {
			const text = await safeFetch(input.url);
			const { geojson, propertyKeys, featureCount } = parseAndValidateGeoJson(text);
			return { propertyKeys, featureCount, geojson };
		} catch (error) {
			throw new HandlerError('BAD_REQUEST', error instanceof Error ? error.message : String(error));
		}
	}

	async addMapBoundary(projectId: string, rawInput: unknown): Promise<CustomBoundarySet[]> {
		const input = parse(addMapBoundarySchema, rawInput);
		const featureCount = await validateBoundarySource(input.url);
		return this.projects.addCustomBoundary(projectId, {
			key: input.key,
			label: input.label,
			url: input.url,
			joinProperty: input.joinProperty,
			regionKeyHint: input.regionKeyHint,
			featureCount,
		});
	}

	async updateMapBoundary(projectId: string, rawInput: unknown): Promise<CustomBoundarySet[]> {
		const input = parse(updateMapBoundarySchema, rawInput);
		const patch: Partial<CustomBoundarySet> = {};
		if (input.newKey) {
			patch.key = input.newKey;
		}
		if (input.label !== undefined) {
			patch.label = input.label;
		}
		if (input.joinProperty !== undefined) {
			patch.joinProperty = input.joinProperty;
		}
		if (input.regionKeyHint !== undefined) {
			patch.regionKeyHint = input.regionKeyHint;
		}
		if (input.url !== undefined) {
			patch.url = input.url;
			patch.featureCount = await validateBoundarySource(input.url);
		}
		return this.projects.updateCustomBoundary(projectId, input.key, patch);
	}

	deleteMapBoundary(projectId: string, rawInput: unknown): Promise<CustomBoundarySet[]> {
		const input = parse(deleteMapBoundarySchema, rawInput);
		return this.projects.deleteCustomBoundary(projectId, input.key);
	}

	private async fetchBoundary(url: string): Promise<FeatureCollection> {
		const cached = getCachedBoundary(url);
		if (cached) {
			return cached;
		}
		const text = await safeFetch(url);
		const { geojson } = parseAndValidateGeoJson(text);
		setCachedBoundary(url, geojson);
		return geojson;
	}
}

async function validateBoundarySource(url: string): Promise<number> {
	try {
		const text = await safeFetch(url);
		return parseAndValidateGeoJson(text).featureCount;
	} catch (error) {
		throw new HandlerError(
			'BAD_REQUEST',
			`Could not load boundaries from URL: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		throw new HandlerError('BAD_REQUEST', parsed.error.issues.map((issue) => issue.message).join('; '));
	}
	return parsed.data;
}
