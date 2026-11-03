import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { inject } from 'vitest';

import type { ConfigService } from '../../config/config.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProjectLlmConfigRepository } from './project-llm-config.repository.js';

/** Encryption at rest of the LLM API keys and credentials, against the e2e Postgres database. */
const ORG_ID = 'plc-org';
const PROJECT_ID = 'plc-project';
const SECRET = 'a-secret-of-at-least-twenty-characters';

let prisma: PrismaService;
let repository: ProjectLlmConfigRepository;

function repositoryWithSecret(secret: string): ProjectLlmConfigRepository {
	return new ProjectLlmConfigRepository(prisma, { env: { BETTER_AUTH_SECRET: secret } } as unknown as ConfigService);
}

function storedRow(provider: string) {
	return prisma.projectLlmConfig.findUniqueOrThrow({
		where: { projectId_provider: { projectId: PROJECT_ID, provider } },
	});
}

beforeAll(async () => {
	const config = { env: { DATABASE_URL: inject('testDatabaseUrl'), DB_SSL: false, DB_QUERY_LOGGING: false } };
	prisma = new PrismaService(config as unknown as ConfigService);
	await prisma.$connect();
	repository = repositoryWithSecret(SECRET);
});

afterAll(async () => {
	await prisma.project.deleteMany({ where: { id: PROJECT_ID } });
	await prisma.organization.deleteMany({ where: { id: ORG_ID } });
	await prisma.$disconnect();
});

beforeEach(async () => {
	await prisma.project.deleteMany({ where: { id: PROJECT_ID } });
	await prisma.organization.deleteMany({ where: { id: ORG_ID } });
	await prisma.organization.create({ data: { id: ORG_ID, name: 'PLC', slug: ORG_ID } });
	await prisma.project.create({
		data: { id: PROJECT_ID, orgId: ORG_ID, name: 'PLC', type: 'local', path: '/tmp/plc' },
	});
});

const baseConfig = { projectId: PROJECT_ID, enabledModels: [], customModels: [], baseUrl: null };

describe('ProjectLlmConfigRepository encryption at rest', () => {
	it('stores the API key and credentials encrypted and reads them back decrypted', async () => {
		const saved = await repository.upsertProjectLlmConfig({
			...baseConfig,
			provider: 'bedrock',
			apiKey: 'sk-test-1234',
			credentials: { accessKeyId: 'AKIA123', secretAccessKey: 'shh' },
		});
		expect(saved.apiKey).toBe('sk-test-1234');
		expect(saved.credentials).toEqual({ accessKeyId: 'AKIA123', secretAccessKey: 'shh' });

		const row = await storedRow('bedrock');
		expect(row.apiKey).toMatch(/^enc:v1:/);
		expect(row.apiKey).not.toContain('sk-test-1234');
		const stored = row.credentials as Record<string, string>;
		expect(Object.keys(stored)).toEqual(['accessKeyId', 'secretAccessKey']);
		expect(Object.values(stored).every((value) => value.startsWith('enc:v1:'))).toBe(true);

		const [read] = await repository.getProjectLlmConfigs(PROJECT_ID);
		expect(read?.apiKey).toBe('sk-test-1234');
		expect(read?.credentials).toEqual({ accessKeyId: 'AKIA123', secretAccessKey: 'shh' });
	});

	it('keeps the stored key on a null apiKey, and keeps empty keys empty', async () => {
		await repository.upsertProjectLlmConfig({ ...baseConfig, provider: 'openai', apiKey: 'sk-keep' });
		await repository.upsertProjectLlmConfig({ ...baseConfig, provider: 'openai', apiKey: null });
		expect((await repository.getProjectLlmConfigByProvider(PROJECT_ID, 'openai'))?.apiKey).toBe('sk-keep');

		await repository.upsertProjectLlmConfig({ ...baseConfig, provider: 'ollama', apiKey: '' });
		expect((await storedRow('ollama')).apiKey).toBe('');
		expect((await repository.getProjectLlmConfigByProvider(PROJECT_ID, 'ollama'))?.apiKey).toBe('');
	});

	it('reads plaintext rows saved before encryption, and encrypts them on module init', async () => {
		await prisma.projectLlmConfig.create({
			data: { projectId: PROJECT_ID, provider: 'openai', apiKey: 'sk-legacy', credentials: { token: 'tok' } },
		});
		expect((await repository.getProjectLlmConfigByProvider(PROJECT_ID, 'openai'))?.apiKey).toBe('sk-legacy');

		await repository.onModuleInit();
		const row = await storedRow('openai');
		expect(row.apiKey).toMatch(/^enc:v1:/);
		expect((row.credentials as Record<string, string>).token).toMatch(/^enc:v1:/);

		const read = await repository.getProjectLlmConfigByProvider(PROJECT_ID, 'openai');
		expect(read?.apiKey).toBe('sk-legacy');
		expect(read?.credentials).toEqual({ token: 'tok' });

		await repository.onModuleInit();
		expect((await storedRow('openai')).apiKey).toBe(row.apiKey);
	});

	it('reads a key encrypted with another secret as missing instead of throwing', async () => {
		await repository.upsertProjectLlmConfig({ ...baseConfig, provider: 'openai', apiKey: 'sk-old-secret' });
		const other = repositoryWithSecret('another-secret-of-twenty-characters');
		expect((await other.getProjectLlmConfigByProvider(PROJECT_ID, 'openai'))?.apiKey).toBe('');
	});
});
