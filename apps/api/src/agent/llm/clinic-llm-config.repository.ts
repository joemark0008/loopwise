import type { LlmProvider } from '@loopwise/shared/types';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { decryptSecret, encryptSecret } from '../../common/utils/encryption.js';
import { ConfigService } from '../../config/config.service.js';
import type { ClinicLlmConfig, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Marks an encrypted value, so rows saved before encryption (plaintext) are told apart and still read. */
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * Port of upstream `queries/clinic-llm-config.queries.ts`. `apiKey` and the `credentials` values are encrypted
 * at rest with the app secret (like the warehouse credentials); every read here returns them decrypted.
 */
@Injectable()
export class ClinicLlmConfigRepository implements OnModuleInit {
	private readonly logger = new Logger(ClinicLlmConfigRepository.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
	) {}

	/** Encrypts rows saved before encryption at rest. Idempotent: encrypted values are skipped. */
	async onModuleInit(): Promise<void> {
		const rows = await this.prisma.clinicLlmConfig.findMany({
			select: { id: true, apiKey: true, credentials: true },
		});
		let count = 0;
		for (const row of rows) {
			const credentials = asStringRecord(row.credentials);
			const plainCredentials = Object.values(credentials ?? {}).some((value) => !isEncrypted(value));
			if (isEncrypted(row.apiKey) && !plainCredentials) {
				continue;
			}
			await this.prisma.clinicLlmConfig.update({
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

	async getClinicLlmConfigs(clinicId: string): Promise<ClinicLlmConfig[]> {
		const configs = await this.prisma.clinicLlmConfig.findMany({ where: { clinicId } });
		return configs.map((config) => this.decryptConfig(config));
	}

	async getClinicLlmConfigByProvider(clinicId: string, provider: LlmProvider): Promise<ClinicLlmConfig | null> {
		const config = await this.prisma.clinicLlmConfig.findUnique({
			where: { clinicId_provider: { clinicId, provider } },
		});
		return config && this.decryptConfig(config);
	}

	/** A null `apiKey` keeps the stored key. */
	async upsertClinicLlmConfig(config: {
		clinicId: string;
		provider: LlmProvider;
		apiKey: string | null;
		enabledModels: string[];
		customModels: Prisma.InputJsonValue;
		baseUrl: string | null;
		credentials?: Prisma.InputJsonValue | null;
		modelSettings?: Prisma.InputJsonValue;
	}): Promise<ClinicLlmConfig> {
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
		const saved = await this.prisma.clinicLlmConfig.upsert({
			where: { clinicId_provider: { clinicId: config.clinicId, provider: config.provider } },
			create: {
				clinicId: config.clinicId,
				provider: config.provider,
				apiKey: apiKey ?? '',
				...shared,
				...credentials,
			},
			update: { ...(apiKey !== null && { apiKey }), ...shared, ...credentials },
		});
		return this.decryptConfig(saved);
	}

	async deleteClinicLlmConfig(clinicId: string, provider: LlmProvider): Promise<void> {
		await this.prisma.clinicLlmConfig.deleteMany({ where: { clinicId, provider } });
	}

	async getDefaultModelSettings(clinicId: string): Promise<unknown> {
		const clinic = await this.prisma.clinic.findUnique({
			where: { id: clinicId },
			select: { defaultModels: true },
		});
		return clinic?.defaultModels ?? null;
	}

	async getAgentSettings(clinicId: string): Promise<unknown> {
		const clinic = await this.prisma.clinic.findUnique({
			where: { id: clinicId },
			select: { agentSettings: true },
		});
		return clinic?.agentSettings ?? null;
	}

	async updateDefaultModelSettings(clinicId: string, settings: Prisma.InputJsonValue): Promise<void> {
		await this.prisma.clinic.update({ where: { id: clinicId }, data: { defaultModels: settings } });
	}

	async updateAgentSettings(clinicId: string, settings: Prisma.InputJsonValue): Promise<void> {
		await this.prisma.clinic.update({ where: { id: clinicId }, data: { agentSettings: settings } });
	}

	/** A configured anthropic, else openai, provider (first half of upstream `getClinicModelProvider`). */
	async getConfiguredTaskProvider(clinicId: string): Promise<LlmProvider | undefined> {
		const configs = await this.getClinicLlmConfigs(clinicId);
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

	private decryptConfig(config: ClinicLlmConfig): ClinicLlmConfig {
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
