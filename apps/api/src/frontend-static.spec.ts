import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { serveFrontend } from './frontend-static.js';

function buildDist(): string {
	const dist = mkdtempSync(path.join(tmpdir(), 'loopwise-dist-'));
	mkdirSync(path.join(dist, 'assets'));
	writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="app"></div>');
	writeFileSync(path.join(dist, 'assets', 'main-abc123.js'), 'console.log(1);');
	writeFileSync(path.join(dist, 'favicon.svg'), '<svg/>');
	return dist;
}

function buildApp(dist: string) {
	const app = express();
	serveFrontend(app, dist);
	app.get('/api/thing', (_req, res) => {
		res.json({ ok: true });
	});
	app.use((_req, res) => {
		res.status(404).send('api 404');
	});
	return app;
}

describe('serveFrontend', () => {
	const app = buildApp(buildDist());

	it('serves index.html for client-side routes', async () => {
		const res = await request(app).get('/stories/abc').expect(200);
		expect(res.text).toContain('<div id="app">');
		expect(res.headers['cache-control']).toBe('no-cache');
	});

	it('serves hashed assets with a long cache and other files as they are', async () => {
		const asset = await request(app).get('/assets/main-abc123.js').expect(200);
		expect(asset.headers['cache-control']).toContain('immutable');
		await request(app).get('/favicon.svg').expect(200);
	});

	it('leaves API paths and non-GET requests to the API', async () => {
		expect((await request(app).get('/api/thing').expect(200)).body).toEqual({ ok: true });
		expect((await request(app).get('/api/missing').expect(404)).text).toBe('api 404');
		expect((await request(app).get('/graphql').expect(404)).text).toBe('api 404');
		expect((await request(app).post('/stories/abc').expect(404)).text).toBe('api 404');
	});

	it('refuses a directory without index.html', () => {
		expect(() => serveFrontend(express(), tmpdir())).toThrow('no index.html');
	});
});
