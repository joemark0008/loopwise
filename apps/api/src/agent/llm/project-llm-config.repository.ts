import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { LlmProvider } from '@quarry/shared/types';

import { decryptSecret, encryptSecret } from '../../common/utils/encryption.js';
import { ConfigService } from '../../config/config.service.js';
import type { Prisma, ProjectLlmConfig } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Marks an encrypted value, so rows saved before encryption (plaintext) are told apart and still read. */
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * Port of upstream `queries/project-llm-config.queries.ts`. `apiKey` and the `credentials` values are encrypted
 * at rest with the app secret (like the warehouse credentials); every read here returns them decrypted.
 */
@Injectable()
export class ProjectLlmConfigRepository implements OnModuleInit {
	private readonly logger = new Logger(ProjectLlmConfigRepository.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
	) {}

	/** Encrypts rows saved before encryption at rest. Idempotent: encrypted values are skipped. */
	async onModuleInit(): Promise<void> {
		const rows = await this.prisma.projectLlmConfig.findMany({
			select: { id: true, apiKey: true, credentials: true },
		});
		let count = 0;
		for (const row of rows) {
			const credentials = asStringRecord(row.credentials);
			const plainCredentials = Object.values(credentials ?? {}).some((value) => !isEncrypted(value));
			if (isEncrypted(row.apiKey) && !plainCredentials) {
				continue;
			}
			await this.prisma.projectLlmConfig.update({
				where: { id: row.id },
				data: {
					apiKey: this.encrypt(row.apiKey),
					...(credentials && { credentials: this.encryptCredentials(credentials) }),
				},
			});
			count++;
		}
		if (count > 0) {
			this.logger.log(`Encrypted the API keys of ${count} LLM config(s) saved before encryption at rest`);
		}
	}

	async getProjectLlmConfigs(projectId: string): Promise<ProjectLlmConfig[]> {
		const configs = await this.prisma.projectLlmConfig.findMany({ where: { projectId } });
		return configs.map((config) => this.decryptConfig(config));
	}

	async getProjectLlmConfigByProvider(projectId: string, provider: LlmProvider): Promise<ProjectLlmConfig | null> {
		const config = await this.prisma.projectLlmConfig.findUnique({
			where: { projectId_provider: { projectId, provider } },
		});
		return config && this.decryptConfig(config);
	}

	/** A null `apiKey` keeps the stored key. */
	async upsertProjectLlmConfig(config: {
		projectId: string;
		provider: LlmProvider;
		apiKey: string | null;
		enabledModels: string[];
		customModels: Prisma.InputJsonValue;
		baseUrl: string | null;
		credentials?: Prisma.InputJsonValue | null;
		modelSettings?: Prisma.InputJsonValue;
	}): Promise<ProjectLlmConfig> {
		const apiKey = config.apiKey === null ? null : this.encrypt(config.apiKey);
		const shared = {
			enabledModels: config.enabledModels,
			customModels: config.customModels,
			baseUrl: config.baseUrl,
			...(config.modelSettings !== undefined && { modelSettings: config.modelSettings }),
		};
		const credentials =
			config.credentials === undefined
				? {}
				: {
						credentials:
							config.credentials === null
								? ({} as Prisma.InputJsonValue)
								: this.encryptCredentials(config.credentials),
					};
		const saved = await this.prisma.projectLlmConfig.upsert({
			where: { projectId_provider: { projectId: config.projectId, provider: config.provider } },
			create: {
				projectId: config.projectId,
				provider: config.provider,
				apiKey: apiKey ?? '',
				...shared,
				...credentials,
			},
			update: { ...(apiKey !== null && { apiKey }), ...shared, ...credentials },
		});
		return this.decryptConfig(saved);
	}

	async deleteProjectLlmConfig(projectId: string, provider: LlmProvider): Promise<void> {
		await this.prisma.projectLlmConfig.deleteMany({ where: { projectId, provider } });
	}

	async getDefaultModelSettings(projectId: string): Promise<unknown> {
		const project = await this.prisma.project.findUnique({
			where: { id: projectId },
			select: { defaultModels: true },
		});
		return project?.defaultModels ?? null;
	}

	async getAgentSettings(projectId: string): Promise<unknown> {
		const project = await this.prisma.project.findUnique({
			where: { id: projectId },
			select: { agentSettings: true },
		});
		return project?.agentSettings ?? null;
	}

	async updateDefaultModelSettings(projectId: string, settings: Prisma.InputJsonValue): Promise<void> {
		await this.prisma.project.update({ where: { id: projectId }, data: { defaultModels: settings } });
	}

	async updateAgentSettings(projectId: string, settings: Prisma.InputJsonValue): Promise<void> {
		await this.prisma.project.update({ where: { id: projectId }, data: { agentSettings: settings } });
	}

	/** A configured anthropic, else openai, provider (first half of upstream `getProjectModelProvider`). */
	async getConfiguredTaskProvider(projectId: string): Promise<LlmProvider | undefined> {
		const configs = await this.getProjectLlmConfigs(projectId);
		return (['anthropic', 'openai'] as LlmProvider[]).find((provider) =>
			configs.some((config) => config.provider === provider),
		);
	}

	/** Empty values (providers without a key) stay empty. */
	private encrypt(value: string): string {
		if (!value) {
			return value;
		}
		return ENCRYPTED_PREFIX + encryptSecret(value, this.config.env.BETTER_AUTH_SECRET);
	}

	/** Plaintext values (saved before encryption) pass through. Undecryptable ones read as missing. */
	private decrypt(value: string, configId: string): string {
		if (!value.startsWith(ENCRYPTED_PREFIX)) {
			return value;
		}
		try {
			return decryptSecret(value.slice(ENCRYPTED_PREFIX.length), this.config.env.BETTER_AUTH_SECRET);
		} catch {
			this.logger.warn(
				`Cannot decrypt a secret of LLM config ${configId} (was BETTER_AUTH_SECRET changed?); re-enter the key`,
			);
			return '';
		}
	}

	/** Encrypts each string value of a credentials record; anything else is stored as given. */
	private encryptCredentials(credentials: Prisma.InputJsonValue): Prisma.InputJsonValue {
		const record = asStringRecord(credentials);
		if (!record) {
			return credentials;
		}
		return Object.fromEntries(
			Object.entries(record).map(([key, value]) => [key, isEncrypted(value) ? value : this.encrypt(value)]),
		);
	}

	private decryptConfig(config: ProjectLlmConfig): ProjectLlmConfig {
		const credentials = asStringRecord(config.credentials);
		return {
			...config,
			apiKey: this.decrypt(config.apiKey, config.id),
			credentials: credentials
				? Object.fromEntries(
						Object.entries(credentials).map(([key, value]) => [key, this.decrypt(value, config.id)]),
					)
				: config.credentials,
		};
	}
}

/** True for values that need no encryption: encrypted ones and empty ones. */
function isEncrypted(value: string): boolean {
	return !value || value.startsWith(ENCRYPTED_PREFIX);
}

/** The credentials column holds a `Record<string, string>`; null for any other JSON shape. */
function asStringRecord(value: unknown): Record<string, string> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}
	const entries = Object.entries(value);
	return entries.every(([, entry]) => typeof entry === 'string') ? Object.fromEntries(entries) : null;
}
