import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

/** Boundary URLs are fetched through `safeFetch`, which refuses local hosts: serve a fixed FeatureCollection. */
const mocks = vi.hoisted(() => ({ fetchedUrls: [] as string[] }));
vi.mock('../src/agent/utils/safe-fetch.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../src/agent/utils/safe-fetch.js')>();
	return {
		...actual,
		safeFetch: vi.fn(async (url: string) => {
			mocks.fetchedUrls.push(url);
			if (url.includes('broken')) {
				return 'not json';
			}
			return JSON.stringify({
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						properties: { code: 'A', name: 'Alpha' },
						geometry: { type: 'Point', coordinates: [0, 0] },
					},
					{
						type: 'Feature',
						properties: { code: 'B', name: 'Beta' },
						geometry: { type: 'Point', coordinates: [1, 1] },
					},
				],
			});
		}),
	};
});

const OTHER_USER_ID = 'charts-other-user';
const OTHER_PROJECT_ID = 'charts-other-project';
const IMAGE_ID = '6f1d1f0e-8a0e-4a59-9f0b-6a5c2d7a9e11';
const FOREIGN_IMAGE_ID = '0b5c8a0e-1f2d-4c3b-9a8e-7d6c5b4a3f21';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHART_CONFIG = {
	title: 'Monthly revenue',
	series: [{ label: 'Revenue', data_key: 'revenue' }],
	query_id: 'query_rev',
	chart_type: 'bar',
	x_axis_key: 'month',
	x_axis_type: 'category',
};
const MAP_CONFIG = {
	query_id: 'query_rev',
	map_type: 'points',
	latitude_key: 'lat',
	longitude_key: 'lon',
	title: 'Stores',
};

/**
 * Charts and maps on Postgres: `/c` chart PNGs, `/i` message images, `/api/map-boundaries`, and the GraphQL
 * operations ported from upstream tRPC `chart.*`, `map.*`, `chartPlugin.*` and `project.*MapBoundar*`.
 */
describe('charts and maps (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let cookie: string[] = [];
	let userId = '';
	let projectId = '';

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.QUARRY_PROJECTS_DIR = await mkdtemp(path.join(tmpdir(), 'quarry-projects-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		({ cookie, userId } = await createTestUser(app, {
			name: 'Ada',
			email: 'ada@example.com',
			password: 'Sup3r-secret!',
		}));
		const project = await graphql('mutation { createProject(input: { name: "Charts" }) { id } }');
		if (!project.body.data) {
			throw new Error(JSON.stringify(project.body.errors));
		}
		projectId = project.body.data.createProject.id;
		await seed();
	});

	afterAll(async () => {
		await app?.close();
	});

	const graphql = (query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(projectId ? { 'x-quarry-project-id': projectId } : {})
			.send({ query, variables });

	async function seed() {
		await prisma.user.create({ data: { id: OTHER_USER_ID, name: 'Other', email: 'other@example.com' } });
		await prisma.project.create({ data: { id: OTHER_PROJECT_ID, name: 'Other', type: 'local', path: '/tmp/x' } });
		await prisma.chat.createMany({
			data: [
				{ id: 'chat-own', userId, projectId, title: 'Mine' },
				{ id: 'chat-colleague', userId: OTHER_USER_ID, projectId, title: 'Colleague' },
				{ id: 'chat-foreign', userId: OTHER_USER_ID, projectId: OTHER_PROJECT_ID, title: 'Foreign' },
			],
		});
		await prisma.chatMessage.createMany({
			data: [
				{ id: 'msg-own', chatId: 'chat-own', role: 'assistant' },
				{ id: 'msg-colleague', chatId: 'chat-colleague', role: 'assistant' },
				{ id: 'msg-foreign', chatId: 'chat-foreign', role: 'assistant' },
			],
		});
		await prisma.messageImage.createMany({
			data: [
				{ id: IMAGE_ID, data: Buffer.from('png-bytes').toString('base64'), mediaType: 'image/png' },
				{ id: FOREIGN_IMAGE_ID, data: Buffer.from('secret').toString('base64'), mediaType: 'image/png' },
			],
		});
		const queryPart = (id: string, messageId: string) => ({
			id: `${id}-sql`,
			messageId,
			order: 0,
			type: 'tool-execute_sql',
			toolName: 'execute_sql',
			toolCallId: `${id}-sql-call`,
			toolState: 'output-available',
			toolInput: { sql_query: 'SELECT 1' },
			toolOutput: {
				id: 'query_rev',
				_version: '1',
				columns: ['month', 'revenue'],
				data: [
					{ month: '2018-01', revenue: 424 },
					{ month: '2018-02', revenue: 400 },
				],
				row_count: 2,
			},
		});
		await prisma.messagePart.createMany({
			data: [
				queryPart('own', 'msg-own'),
				{
					id: 'own-chart',
					messageId: 'msg-own',
					order: 1,
					type: 'tool-display_chart',
					toolName: 'display_chart',
					toolCallId: 'own-chart-call',
					toolState: 'output-available',
					toolInput: CHART_CONFIG,
				},
				{
					id: 'own-map',
					messageId: 'msg-own',
					order: 2,
					type: 'tool-display_map',
					toolName: 'display_map',
					toolCallId: 'own-map-call',
					toolState: 'output-available',
					toolInput: MAP_CONFIG,
				},
				{
					id: 'own-image',
					messageId: 'msg-own',
					order: 3,
					type: 'file',
					mediaType: 'image/png',
					imageId: IMAGE_ID,
				},
				queryPart('colleague', 'msg-colleague'),
				{
					id: 'colleague-chart',
					messageId: 'msg-colleague',
					order: 1,
					type: 'tool-display_chart',
					toolName: 'display_chart',
					toolCallId: 'colleague-chart-call',
					toolState: 'output-available',
					toolInput: CHART_CONFIG,
				},
				{
					id: 'foreign-image',
					messageId: 'msg-foreign',
					order: 0,
					type: 'file',
					mediaType: 'image/png',
					imageId: FOREIGN_IMAGE_ID,
				},
			],
		});
	}

	describe('chart PNGs (/c)', () => {
		it('serves a stored chart without a session, like upstream', async () => {
			const chart = await prisma.chartImage.create({
				data: { toolCallId: 'own-chart-call', data: PNG_SIGNATURE.toString('base64') },
			});
			const res = await request(app.getHttpServer()).get(`/c/chat-own/${chart.id}.png`).expect(200);
			expect(res.headers['content-type']).toBe('image/png');
			expect(Buffer.from(res.body).subarray(0, 8)).toEqual(PNG_SIGNATURE);
		});

		it('answers 404 for an unknown chart', async () => {
			await request(app.getHttpServer()).get('/c/chat-own/unknown.png').expect(404);
		});
	});

	describe('message images (/i)', () => {
		it('refuses an anonymous request', async () => {
			await request(app.getHttpServer()).get(`/i/${IMAGE_ID}`).expect(401);
		});

		it('serves an image of a chat the user can open, privately cached', async () => {
			const res = await request(app.getHttpServer()).get(`/i/${IMAGE_ID}`).set('Cookie', cookie).expect(200);
			expect(res.headers['content-type']).toBe('image/png');
			expect(res.headers['cache-control']).toContain('private');
			expect(Buffer.from(res.body).toString()).toBe('png-bytes');
		});

		it('hides an image that only a chat of another project shows', async () => {
			await request(app.getHttpServer()).get(`/i/${FOREIGN_IMAGE_ID}`).set('Cookie', cookie).expect(404);
		});
	});

	describe('chart download and edits', () => {
		it('renders a chart as a base64 PNG', async () => {
			const res = await graphql('query ($id: String!) { chartDownload(toolCallId: $id) }', {
				id: 'own-chart-call',
			});
			expect(res.body.errors).toBeUndefined();
			const png = Buffer.from(res.body.data.chartDownload, 'base64');
			expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
		});

		it("lets a project admin download a colleague's chart, which they can replay", async () => {
			const res = await graphql('query ($id: String!) { chartDownload(toolCallId: $id) }', {
				id: 'colleague-chart-call',
			});
			expect(res.body.errors).toBeUndefined();
		});

		it('answers NOT_FOUND for an unknown visualization', async () => {
			const res = await graphql('query ($id: String!) { chartDownload(toolCallId: $id) }', { id: 'nope' });
			expect(res.body.errors[0].extensions.code).toBe('NOT_FOUND');
		});

		it('updates the config of an owned chart and drops its cached PNG', async () => {
			const config = { ...CHART_CONFIG, title: 'Renamed' };
			const res = await graphql(
				'mutation ($id: String!, $config: JSON!) { updateChartConfig(toolCallId: $id, config: $config) }',
				{
					id: 'own-chart-call',
					config,
				},
			);
			expect(res.body.data.updateChartConfig).toBe(true);
			const part = await prisma.messagePart.findUniqueOrThrow({ where: { id: 'own-chart' } });
			expect(part.toolInput).toMatchObject({ title: 'Renamed' });
			expect(await prisma.chartImage.count({ where: { toolCallId: 'own-chart-call' } })).toBe(0);
		});

		it("refuses to edit a colleague's chart", async () => {
			const res = await graphql(
				'mutation ($id: String!, $config: JSON!) { updateChartConfig(toolCallId: $id, config: $config) }',
				{
					id: 'colleague-chart-call',
					config: CHART_CONFIG,
				},
			);
			expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
		});

		it('rejects an invalid chart config', async () => {
			const res = await graphql(
				'mutation ($id: String!, $config: JSON!) { updateChartConfig(toolCallId: $id, config: $config) }',
				{
					id: 'own-chart-call',
					config: { chart_type: 'bar' },
				},
			);
			expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
		});

		it('updates an owned map config, validated against the map schema', async () => {
			const update = (config: unknown) =>
				graphql('mutation ($id: String!, $config: JSON!) { updateMapConfig(mapId: $id, config: $config) }', {
					id: 'own-map-call',
					config,
				});
			expect((await update({ ...MAP_CONFIG, title: 'Shops' })).body.data.updateMapConfig).toBe(true);
			const part = await prisma.messagePart.findUniqueOrThrow({ where: { id: 'own-map' } });
			expect(part.toolInput).toMatchObject({ title: 'Shops' });

			const invalid = await update({ ...MAP_CONFIG, map_type: 'choropleth' });
			expect(invalid.body.errors[0].extensions.code).toBe('BAD_REQUEST');
		});

		it('lists no chart plugins for a project without a charts folder', async () => {
			const res = await graphql('{ chartPlugins }');
			expect(res.body.data.chartPlugins).toEqual([]);
			const source = await graphql('{ chartPluginSource(type: "funnel", version: "1") { source version } }');
			expect(source.body.errors[0].extensions.code).toBe('NOT_FOUND');
		});
	});

	describe('map boundaries', () => {
		const add = (input: Record<string, unknown>) =>
			graphql('mutation ($input: JSON!) { addMapBoundary(input: $input) }', { input });
		const BOUNDARY = {
			key: 'sales_regions',
			label: 'Sales regions',
			url: 'https://example.com/regions.geojson',
			joinProperty: 'code',
			regionKeyHint: 'match the region code',
		};

		it('starts with no custom boundary sets', async () => {
			const res = await graphql('{ mapBoundaries }');
			expect(res.body.data.mapBoundaries).toEqual([]);
		});

		it('validates a boundary URL', async () => {
			const res = await graphql('mutation { validateMapBoundaryUrl(url: "https://example.com/a.geojson") }');
			expect(res.body.data.validateMapBoundaryUrl).toMatchObject({ featureCount: 2 });
			expect(res.body.data.validateMapBoundaryUrl.propertyKeys).toEqual(expect.arrayContaining(['code', 'name']));

			const broken = await graphql('mutation { validateMapBoundaryUrl(url: "https://example.com/broken") }');
			expect(broken.body.errors[0].extensions.code).toBe('BAD_REQUEST');
		});

		it("rejects a key that isn't lowercase letters, digits or underscores", async () => {
			const res = await add({ ...BOUNDARY, key: 'Sales Regions' });
			expect(res.body.errors[0].extensions.code).toBe('BAD_REQUEST');
			expect(res.body.errors[0].message).toContain('lowercase letters');
		});

		it('adds a boundary set with its feature count, and refuses a duplicate key', async () => {
			const res = await add(BOUNDARY);
			expect(res.body.data.addMapBoundary).toEqual([{ ...BOUNDARY, featureCount: 2 }]);
			const duplicate = await add(BOUNDARY);
			expect(duplicate.body.errors[0].message).toContain('already exists');
		});

		it('renames and relabels a boundary set', async () => {
			const res = await graphql('mutation ($input: JSON!) { updateMapBoundary(input: $input) }', {
				input: { key: 'sales_regions', newKey: 'regions', label: 'Regions' },
			});
			expect(res.body.data.updateMapBoundary).toEqual([
				{ ...BOUNDARY, key: 'regions', label: 'Regions', featureCount: 2 },
			]);
		});

		it('offers the custom set to the map editor', async () => {
			const res = await graphql(
				'mutation ($id: String!, $config: JSON!) { updateMapConfig(mapId: $id, config: $config) }',
				{
					id: 'own-map-call',
					config: {
						...MAP_CONFIG,
						map_type: 'choropleth',
						value_key: 'revenue',
						region_key: 'month',
						region_boundaries: 'regions',
					},
				},
			);
			expect(res.body.data.updateMapConfig).toBe(true);
		});

		it('serves a custom or built-in boundary set to project members', async () => {
			const custom = await request(app.getHttpServer())
				.get(`/api/map-boundaries/${projectId}/regions`)
				.set('Cookie', cookie)
				.expect(200);
			expect(custom.body.features).toHaveLength(2);
			expect(custom.headers['cache-control']).toBe('private, max-age=600');

			await request(app.getHttpServer())
				.get(`/api/map-boundaries/${projectId}/world_countries`)
				.set('Cookie', cookie)
				.expect(200);
			await request(app.getHttpServer())
				.get(`/api/map-boundaries/${projectId}/unknown_set`)
				.set('Cookie', cookie)
				.expect(404);
		});

		it('refuses boundaries of a project the user is not in, and anonymous requests', async () => {
			await request(app.getHttpServer())
				.get(`/api/map-boundaries/${OTHER_PROJECT_ID}/world_countries`)
				.set('Cookie', cookie)
				.expect(403);
			await request(app.getHttpServer()).get(`/api/map-boundaries/${projectId}/world_countries`).expect(401);
		});

		it('proxies a GeoJSON URL', async () => {
			const res = await request(app.getHttpServer())
				.get('/api/map-boundaries/proxy')
				.query({ url: 'https://example.com/proxied.geojson' })
				.set('Cookie', cookie)
				.expect(200);
			expect(res.body.type).toBe('FeatureCollection');
			expect(res.headers['cache-control']).toBe('private, max-age=86400');
			expect(mocks.fetchedUrls).toContain('https://example.com/proxied.geojson');
		});

		it('deletes a boundary set', async () => {
			const res = await graphql('mutation { deleteMapBoundary(key: "regions") }');
			expect(res.body.data.deleteMapBoundary).toEqual([]);
		});
	});
});
