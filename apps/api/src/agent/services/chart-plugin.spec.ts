import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { listChartPlugins, readChartPlugin } from './chart-plugin.js';

const clinicFolders: string[] = [];

afterEach(() => {
	for (const folder of clinicFolders) {
		rmSync(folder, { recursive: true, force: true });
	}
	clinicFolders.length = 0;
});

describe('chart plugins', () => {
	it('discovers flat JavaScript modules with optional metadata', () => {
		const clinic = createClinic();
		const chartsFolder = join(clinic, 'agent', 'charts');
		writeFileSync(join(chartsFolder, 'bubble.js'), 'export function render() {}');
		writeFileSync(
			join(chartsFolder, 'bubble.json'),
			JSON.stringify({ name: 'Bubble chart', description: 'Shows three numeric dimensions.' }),
		);
		writeFileSync(join(chartsFolder, 'progress-bars.mjs'), 'export function render() {}');

		expect(listChartPlugins(clinic)).toEqual([
			{
				type: 'bubble',
				name: 'Bubble chart',
				description: 'Shows three numeric dimensions.',
				version: expect.stringMatching(/^[a-f0-9]{16}$/),
			},
			{
				type: 'progress-bars',
				name: 'Progress Bars',
				description: '',
				version: expect.stringMatching(/^[a-f0-9]{16}$/),
			},
		]);
	});

	it('returns source and changes the version when source changes', () => {
		const clinic = createClinic();
		const file = join(clinic, 'agent', 'charts', 'bubble.js');
		writeFileSync(file, 'export function render() { return 1; }');

		const first = readChartPlugin(clinic, 'bubble');
		writeFileSync(file, 'export function render() { return 2; }');
		const second = readChartPlugin(clinic, 'bubble');

		expect(first?.source).toContain('return 1');
		expect(second?.source).toContain('return 2');
		expect(second?.entry.version).not.toBe(first?.entry.version);
	});

	it('ignores built-ins, duplicate types, nested files, and symlinks', () => {
		const clinic = createClinic();
		const chartsFolder = join(clinic, 'agent', 'charts');
		const outsideFile = join(clinic, 'outside.js');
		writeFileSync(join(chartsFolder, 'bar.js'), 'export function render() {}');
		writeFileSync(join(chartsFolder, 'duplicate.js'), 'export function render() {}');
		writeFileSync(join(chartsFolder, 'duplicate.mjs'), 'export function render() {}');
		writeFileSync(outsideFile, 'secret');
		symlinkSync(outsideFile, join(chartsFolder, 'linked.js'));
		mkdirSync(join(chartsFolder, 'nested'));
		writeFileSync(join(chartsFolder, 'nested', 'nested.js'), 'export function render() {}');

		expect(listChartPlugins(clinic)).toEqual([]);
	});

	it('rejects a charts directory that links outside the clinic', () => {
		const clinic = createClinic(false);
		const outside = createClinic();
		const agentFolder = join(clinic, 'agent');
		mkdirSync(agentFolder, { recursive: true });
		symlinkSync(join(outside, 'agent', 'charts'), join(agentFolder, 'charts'));
		writeFileSync(join(outside, 'agent', 'charts', 'leak.js'), 'export function render() {}');

		expect(listChartPlugins(clinic)).toEqual([]);
	});

	it('keeps clinic discovery isolated without shared state', () => {
		const firstClinic = createClinic();
		const secondClinic = createClinic();
		writeFileSync(join(firstClinic, 'agent', 'charts', 'first.js'), 'export function render() {}');
		writeFileSync(join(secondClinic, 'agent', 'charts', 'second.js'), 'export function render() {}');

		expect(listChartPlugins(firstClinic).map((plugin) => plugin.type)).toEqual(['first']);
		expect(listChartPlugins(secondClinic).map((plugin) => plugin.type)).toEqual(['second']);
	});
});

function createClinic(withChartsFolder = true): string {
	const clinic = mkdtempSync(join(tmpdir(), 'loopwise-chart-plugin-'));
	clinicFolders.push(clinic);
	if (withChartsFolder) {
		mkdirSync(join(clinic, 'agent', 'charts'), { recursive: true });
	}
	return clinic;
}
