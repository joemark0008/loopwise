import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { extractConfiguredRepos, extractRequiredEnvVars } from './loopwise-config.js';

vi.mock('./logger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('extractRequiredEnvVars', () => {
	it('returns env vars declared in loopwise_config.yaml', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loopwise-config-'));
		try {
			fs.writeFileSync(
				path.join(dir, 'loopwise_config.yaml'),
				[
					'clinic_name: demo',
					'databases:',
					'  - name: warehouse',
					'    type: postgres',
					'    password: "{{ env(\'DB_PASSWORD\') }}"',
				].join('\n'),
			);

			expect(extractRequiredEnvVars(dir)).toEqual(['DB_PASSWORD']);
		} finally {
			fs.rmSync(dir, { force: true, recursive: true });
		}
	});

	it('returns env vars declared in mcp.json', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loopwise-config-'));
		try {
			const mcpDir = path.join(dir, 'agent', 'mcps');
			fs.mkdirSync(mcpDir, { recursive: true });
			fs.writeFileSync(
				path.join(mcpDir, 'mcp.json'),
				JSON.stringify({
					mcpServers: {
						dbt: {
							command: 'npx',
							args: ['-y', '@example/dbt-mcp'],
							env: {
								DBT_TOKEN: '${DBT_TOKEN}',
							},
						},
					},
				}),
			);

			expect(extractRequiredEnvVars(dir)).toEqual(['DBT_TOKEN']);
		} finally {
			fs.rmSync(dir, { force: true, recursive: true });
		}
	});

	it('deduplicates env vars across loopwise_config.yaml and mcp.json', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loopwise-config-'));
		try {
			const mcpDir = path.join(dir, 'agent', 'mcps');
			fs.mkdirSync(mcpDir, { recursive: true });
			fs.writeFileSync(path.join(dir, 'loopwise_config.yaml'), 'password: "{{ env(\'DB_PASSWORD\') }}"\n');
			fs.writeFileSync(
				path.join(mcpDir, 'mcp.json'),
				JSON.stringify({
					mcpServers: {
						warehouse: {
							command: 'npx',
							env: {
								DB_PASSWORD: '${DB_PASSWORD}',
								DBT_TOKEN: '${DBT_TOKEN}',
							},
						},
					},
				}),
			);

			expect(extractRequiredEnvVars(dir)).toEqual(['DB_PASSWORD', 'DBT_TOKEN']);
		} finally {
			fs.rmSync(dir, { force: true, recursive: true });
		}
	});

	it('skips config files that cannot be read', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loopwise-config-'));
		try {
			const mcpConfigPath = path.join(dir, 'agent', 'mcps', 'mcp.json');
			fs.mkdirSync(mcpConfigPath, { recursive: true });

			expect(extractRequiredEnvVars(dir)).toEqual([]);
		} finally {
			fs.rmSync(dir, { force: true, recursive: true });
		}
	});
});

describe('extractConfiguredRepos', () => {
	it('returns repos declared in loopwise_config.yaml with GitHub metadata', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loopwise-config-'));
		try {
			fs.writeFileSync(
				path.join(dir, 'loopwise_config.yaml'),
				[
					'clinic_name: demo',
					'repos:',
					'  - name: dbt-models',
					'    url: https://github.com/loopwise/dbt-models.git',
					'    branch: main',
					'  - name: local-docs',
					'    local_path: ../docs',
				].join('\n'),
			);

			expect(extractConfiguredRepos(dir)).toEqual([
				{
					branch: 'main',
					contextPath: 'repos/dbt-models',
					localPath: null,
					name: 'dbt-models',
					provider: 'github',
					repoFullName: 'loopwise/dbt-models',
					url: 'https://github.com/loopwise/dbt-models.git',
				},
				{
					branch: null,
					contextPath: 'repos/local-docs',
					localPath: '../docs',
					name: 'local-docs',
					provider: null,
					repoFullName: null,
					url: null,
				},
			]);
		} finally {
			fs.rmSync(dir, { force: true, recursive: true });
		}
	});

	it('returns repos declared in loopwise_config.yaml with GitLab metadata', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loopwise-config-'));
		try {
			fs.writeFileSync(
				path.join(dir, 'loopwise_config.yaml'),
				[
					'clinic_name: demo',
					'repos:',
					'  - name: dbt-models',
					'    url: https://gitlab.com/loopwise/dbt-models.git',
					'    branch: main',
				].join('\n'),
			);

			expect(extractConfiguredRepos(dir)).toEqual([
				{
					branch: 'main',
					contextPath: 'repos/dbt-models',
					localPath: null,
					name: 'dbt-models',
					provider: 'gitlab',
					repoFullName: 'loopwise/dbt-models',
					url: 'https://gitlab.com/loopwise/dbt-models.git',
				},
			]);
		} finally {
			fs.rmSync(dir, { force: true, recursive: true });
		}
	});

	it('leaves provider null when the repo url does not match a recognized host', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loopwise-config-'));
		try {
			fs.writeFileSync(
				path.join(dir, 'loopwise_config.yaml'),
				[
					'clinic_name: demo',
					'repos:',
					'  - name: dbt-models',
					'    url: https://bitbucket.org/loopwise/dbt-models.git',
				].join('\n'),
			);

			expect(extractConfiguredRepos(dir)).toEqual([
				{
					branch: null,
					contextPath: 'repos/dbt-models',
					localPath: null,
					name: 'dbt-models',
					provider: null,
					repoFullName: null,
					url: 'https://bitbucket.org/loopwise/dbt-models.git',
				},
			]);
		} finally {
			fs.rmSync(dir, { force: true, recursive: true });
		}
	});
});
