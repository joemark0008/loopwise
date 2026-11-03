import path from 'node:path';

import { loadDotenv, type StorageEnv, storageEnvSchema } from '../../config/env.js';
import { LocalStorageProvider } from './local.provider.js';
import { S3StorageProvider } from './s3.provider.js';
import type { StorageBackendSetting, StorageHealth, StorageProvider } from './types.js';

/**
 * Port of upstream `services/storage/index.ts`. Upstream reads its module-level `env`; quarry has no such object
 * (the validated env lives in `ConfigService`), so the storage variables are parsed from `process.env` on first
 * use, after loading `.env` as upstream's `env.ts` does on import (tool descriptions read them at module load,
 * before `ConfigModule` runs). `__reloadEnvForTesting` re-reads them, like upstream's.
 */
export { relativePathFromKey, sanitizeRelativePath, scopedKey, scopeRoot } from './keys.js';
export type {
	StorageBackend,
	StorageBackendSetting,
	StorageHealth,
	StorageObject,
	StorageProvider,
	StorageScope,
} from './types.js';

export type CredentialSource = 'explicit' | 'default-chain';

export interface StorageConfigSummary {
	backend: StorageBackendSetting;
	maxFileSizeMb: number;
	local?: { path: string };
	s3?: {
		bucket: string;
		region?: string;
		endpoint?: string;
		prefix?: string;
		forcePathStyle: boolean;
		credentialSource: CredentialSource;
		accessKeyId?: string;
	};
}

export const STORAGE_DISABLED_MESSAGE =
	'Permanent storage is disabled on this Loopwise instance. Ask an admin to set QUARRY_STORAGE_BACKEND to `local` or `s3`.';

let provider: StorageProvider | null = null;
let storageEnv: StorageEnv | null = null;

/** The storage variables (`QUARRY_STORAGE_*`). */
export const getStorageEnv = (): StorageEnv => {
	if (!storageEnv) {
		loadDotenv();
		storageEnv = storageEnvSchema.parse(process.env);
	}
	return storageEnv;
};

/** `QUARRY_STORAGE_MAX_FILE_SIZE_MB`. */
export const getStorageMaxFileSizeMb = (): number => {
	return getStorageEnv().QUARRY_STORAGE_MAX_FILE_SIZE_MB;
};

export const isStorageEnabled = (): boolean => {
	return getStorageEnv().QUARRY_STORAGE_BACKEND !== 'none';
};

/** @throws Error when permanent storage is disabled. */
export const getStorage = (): StorageProvider => {
	if (!isStorageEnabled()) {
		throw new Error(STORAGE_DISABLED_MESSAGE);
	}
	provider ??= createProvider();
	return provider;
};

export const getStorageHealth = async (): Promise<StorageHealth> => {
	if (!isStorageEnabled()) {
		return { ok: false, error: STORAGE_DISABLED_MESSAGE };
	}
	return getStorage().healthCheck();
};

/** Display-safe view of the configuration; secrets never leave this module. */
export const getStorageConfig = (): StorageConfigSummary => {
	const env = getStorageEnv();
	const maxFileSizeMb = env.QUARRY_STORAGE_MAX_FILE_SIZE_MB;

	if (env.QUARRY_STORAGE_BACKEND === 'none') {
		return { backend: 'none', maxFileSizeMb };
	}

	if (env.QUARRY_STORAGE_BACKEND === 's3') {
		return {
			backend: 's3',
			maxFileSizeMb,
			s3: {
				bucket: env.QUARRY_STORAGE_S3_BUCKET ?? '',
				region: env.QUARRY_STORAGE_S3_REGION,
				endpoint: env.QUARRY_STORAGE_S3_ENDPOINT,
				prefix: env.QUARRY_STORAGE_S3_PREFIX,
				forcePathStyle: env.QUARRY_STORAGE_S3_FORCE_PATH_STYLE,
				credentialSource: hasExplicitS3Credentials(env) ? 'explicit' : 'default-chain',
				accessKeyId: maskCredential(env.QUARRY_STORAGE_S3_ACCESS_KEY_ID),
			},
		};
	}

	return {
		backend: 'local',
		maxFileSizeMb,
		local: { path: path.resolve(env.QUARRY_STORAGE_LOCAL_PATH) },
	};
};

/** TEST ONLY — re-reads the storage variables from `process.env` (upstream `__reloadEnvForTesting`). */
export const __reloadEnvForTesting = (): void => {
	storageEnv = null;
};

/** TEST ONLY — drops the cached provider (and env) so a new env can take effect. */
export const __resetStorageForTesting = (): void => {
	provider = null;
	storageEnv = null;
};

const createProvider = (): StorageProvider => {
	const env = getStorageEnv();
	if (env.QUARRY_STORAGE_BACKEND === 's3') {
		return new S3StorageProvider({
			bucket: env.QUARRY_STORAGE_S3_BUCKET!,
			region: env.QUARRY_STORAGE_S3_REGION,
			endpoint: env.QUARRY_STORAGE_S3_ENDPOINT,
			prefix: env.QUARRY_STORAGE_S3_PREFIX,
			forcePathStyle: env.QUARRY_STORAGE_S3_FORCE_PATH_STYLE,
			accessKeyId: env.QUARRY_STORAGE_S3_ACCESS_KEY_ID,
			secretAccessKey: env.QUARRY_STORAGE_S3_SECRET_ACCESS_KEY,
		});
	}

	return new LocalStorageProvider(env.QUARRY_STORAGE_LOCAL_PATH);
};

const hasExplicitS3Credentials = (env: StorageEnv): boolean => {
	return Boolean(env.QUARRY_STORAGE_S3_ACCESS_KEY_ID && env.QUARRY_STORAGE_S3_SECRET_ACCESS_KEY);
};

const maskCredential = (value: string | undefined): string | undefined => {
	if (!value) {
		return undefined;
	}
	if (value.length <= 8) {
		return '••••••••';
	}
	return `${value.slice(0, 4)}••••${value.slice(-4)}`;
};
