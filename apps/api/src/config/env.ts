import crypto from 'node:crypto';
import path from 'node:path';

import { isLlmProvider, LLM_PROVIDERS, NAMED_PROVIDER_KIND } from '@loopwise/shared/types';
import dotenv from 'dotenv';
import { z } from 'zod/v4';

/**
 * Port of upstream `apps/backend/src/env.ts`, minus billing (Stripe, credits), enterprise SSO
 * (OIDC, Microsoft Entra), the license key and cloud-only settings: loopwise is self-hosted only.
 * Settings of areas not ported (Redis, SMTP sending, Slack, the MCP server's OAuth, PostHog, Langfuse) are left out
 * too; see `docs/deferred-features.md`. `DB_URI` is `DATABASE_URL` (Prisma) and `SERVER_PORT` is `PORT`.
 */

const optionalNonEmptyString = z
	.string()
	.optional()
	.transform((value) => value?.trim() || undefined);

const booleanString = (defaultValue: 'true' | 'false') =>
	z
		.enum(['true', 'false'])
		.optional()
		.default(defaultValue)
		.transform((val) => val === 'true');

const baseEnvSchema = z.object({
	MODE: z.enum(['dev', 'prod', 'test']).default('dev'),
	PORT: z.coerce.number().int().positive().default(5006),

	DATABASE_URL: z.string().min(1, { message: 'DATABASE_URL is required' }),
	/**
	 * Wise analytics (migration 0015) connects as the `loopwise_analyst` login role, never as the app's user. Defaults
	 * to DATABASE_URL with the synthetic development credentials `loopwise_analyst:loopwise_analyst`.
	 */
	ANALYTICS_DATABASE_URL: z.string().optional(),
	DB_SSL: z
		.enum(['true', 'false'])
		.optional()
		.transform((val) => val === 'true'),
	DB_QUERY_LOGGING: z
		.enum(['true', 'false'])
		.optional()
		.transform((val) => val === 'true'),

	BETTER_AUTH_URL: z.url({ message: 'BETTER_AUTH_URL must be a valid URL' }).default('http://localhost:5005/'),
	/** Required in `prod` (see `envSchema`); `dev` and `test` get a random secret per process when unset. */
	BETTER_AUTH_SECRET: optionalNonEmptyString.pipe(z.string().min(20).optional()),

	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	GOOGLE_AUTH_DOMAINS: z.string().optional(),

	GITHUB_CLIENT_ID: z.string().optional(),
	GITHUB_CLIENT_SECRET: z.string().optional(),
	GITHUB_ALLOWED_USERS: z.string().optional(),
	GITHUB_SSO: booleanString('false'),

	GITLAB_CLIENT_ID: z.string().optional(),
	GITLAB_CLIENT_SECRET: z.string().optional(),
	GITLAB_ALLOWED_USERS: z.string().optional(),
	GITLAB_SSO: booleanString('false'),
	GITLAB_BASE_URL: optionalNonEmptyString.pipe(z.url({ message: 'GITLAB_BASE_URL must be a valid URL' }).optional()),

	ENABLE_USER_LOGIN: booleanString('true'),

	SMTP_HOST: optionalNonEmptyString,
	SMTP_MAIL_FROM: optionalNonEmptyString,

	/** On SIGTERM, how long /health reports unhealthy while still serving, so a load balancer can move traffic away. */
	SHUTDOWN_DRAIN_DELAY_MS: z.coerce.number().int().nonnegative().default(0),
	APP_VERSION: z.string().default('dev'),
	APP_COMMIT: z.string().default('unknown'),
	APP_BUILD_DATE: z.string().default(''),
	/** GitHub `owner/name` whose releases the update check compares against. Unset: no update check. */
	LOOPWISE_RELEASES_REPOSITORY: optionalNonEmptyString,

	LOOPWISE_DEFAULT_PROJECT_PATH: z.string().optional(),
	LOOPWISE_PROJECTS_DIR: z.string().default('./projects'),
	/** `off`: skills are managed as files only, the app and the agent's drafts can't save them. */
	LOOPWISE_SKILL_AUTHORING: z.enum(['auto', 'off']).default('auto'),
	/** Built frontend (`apps/frontend/dist`) served by the API, as in the Docker image. Unset in development (Vite). */
	LOOPWISE_FRONTEND_DIST: optionalNonEmptyString,

	LOOPWISE_STORAGE_BACKEND: z.enum(['none', 'local', 's3']).default('local'),
	LOOPWISE_STORAGE_LOCAL_PATH: z.string().default('./storage'),
	LOOPWISE_STORAGE_S3_BUCKET: optionalNonEmptyString,
	LOOPWISE_STORAGE_S3_REGION: optionalNonEmptyString,
	LOOPWISE_STORAGE_S3_ENDPOINT: optionalNonEmptyString.pipe(
		z.url({ message: 'LOOPWISE_STORAGE_S3_ENDPOINT must be a valid URL' }).optional(),
	),
	LOOPWISE_STORAGE_S3_PREFIX: optionalNonEmptyString,
	LOOPWISE_STORAGE_S3_ACCESS_KEY_ID: optionalNonEmptyString,
	LOOPWISE_STORAGE_S3_SECRET_ACCESS_KEY: optionalNonEmptyString,
	LOOPWISE_STORAGE_S3_FORCE_PATH_STYLE: booleanString('false'),
	LOOPWISE_STORAGE_MAX_FILE_SIZE_MB: z.coerce
		.number({ message: 'LOOPWISE_STORAGE_MAX_FILE_SIZE_MB must be a number of megabytes' })
		.positive({ message: 'LOOPWISE_STORAGE_MAX_FILE_SIZE_MB must be greater than 0' })
		.default(10),

	/**
	 * Default for the MCP endpoint toggle (Settings > MCP Endpoint) while a project has no stored
	 * settings. Once an admin saves the settings, the stored value wins and this is ignored.
	 */
	MCP_ENDPOINT_ENABLED: z
		.enum(['true', 'false'])
		.optional()
		.transform((val) => (val === undefined ? undefined : val === 'true')),

	/**
	 * Comma-separated providers to keep out of the deployment entirely, regardless of where their
	 * credentials come from. Accepts provider kinds and named instances (openaiCompatible/name).
	 */
	DISABLED_PROVIDERS: z
		.string()
		.optional()
		.transform((val) =>
			(val ?? '')
				.split(',')
				.map((entry) => entry.trim())
				.filter(Boolean),
		)
		.refine((providers) => providers.every(isLlmProvider), {
			message: `DISABLED_PROVIDERS must be a comma-separated list of provider kinds (${LLM_PROVIDERS.join(', ')}) or named instances (${NAMED_PROVIDER_KIND}/<name>)`,
		}),

	BETA_AUTOMATIONS_ENABLED: booleanString('true'),
	BETA_CONTEXT_RECOMMENDATIONS_ENABLED: booleanString('true'),
	BETA_STORY_FILTERS_ENABLED: booleanString('true'),
	BETA_CUSTOM_STORIES_ENABLED: booleanString('false'),
	BETA_SUBAGENTS_ENABLED: booleanString('false'),
});

export const envSchema = baseEnvSchema
	.superRefine((data, ctx) => {
		if (data.MODE === 'prod' && !data.BETTER_AUTH_SECRET) {
			ctx.addIssue({
				code: 'custom',
				path: ['BETTER_AUTH_SECRET'],
				message:
					'BETTER_AUTH_SECRET is required when MODE=prod: it signs sessions and derives the setup token, so every replica and restart must share one value (generate one with `openssl rand -base64 32`).',
			});
		}
		if (data.LOOPWISE_STORAGE_BACKEND === 's3' && !data.LOOPWISE_STORAGE_S3_BUCKET) {
			ctx.addIssue({
				code: 'custom',
				path: ['LOOPWISE_STORAGE_S3_BUCKET'],
				message: 'LOOPWISE_STORAGE_S3_BUCKET is required when LOOPWISE_STORAGE_BACKEND=s3.',
			});
		}
	})
	.transform((data) => ({
		...data,
		BETTER_AUTH_SECRET: data.BETTER_AUTH_SECRET ?? crypto.randomBytes(32).toString('hex'),
	}));

export type Env = z.output<typeof envSchema>;

/**
 * The permanent-storage variables alone. Upstream's storage reads the module-level `env`; loopwise's storage
 * (`attachments/storage`) stays module-level too, so it parses these from `process.env` itself.
 */
export const storageEnvSchema = baseEnvSchema.pick({
	LOOPWISE_STORAGE_BACKEND: true,
	LOOPWISE_STORAGE_LOCAL_PATH: true,
	LOOPWISE_STORAGE_S3_BUCKET: true,
	LOOPWISE_STORAGE_S3_REGION: true,
	LOOPWISE_STORAGE_S3_ENDPOINT: true,
	LOOPWISE_STORAGE_S3_PREFIX: true,
	LOOPWISE_STORAGE_S3_ACCESS_KEY_ID: true,
	LOOPWISE_STORAGE_S3_SECRET_ACCESS_KEY: true,
	LOOPWISE_STORAGE_S3_FORCE_PATH_STYLE: true,
	LOOPWISE_STORAGE_MAX_FILE_SIZE_MB: true,
});

export type StorageEnv = z.output<typeof storageEnvSchema>;

export class EnvValidationError extends Error {
	constructor(readonly issues: string[]) {
		super(`Invalid environment:\n${issues.join('\n')}`);
		this.name = 'EnvValidationError';
	}
}

/** Parses and validates the environment. Throws `EnvValidationError` listing every invalid variable. */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
	const result = envSchema.safeParse(source);
	if (!result.success) {
		throw new EnvValidationError(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
	}
	return result.data;
}

/** Loads the `.env` file at the root of the repository (shared by every app) into `process.env`. */
export function loadDotenv(): void {
	dotenv.config({ path: path.join(import.meta.dirname, '..', '..', '..', '..', '.env'), quiet: true });
}
