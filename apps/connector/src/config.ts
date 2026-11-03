import type { LogLevel } from './logger.ts';

export interface ConnectorConfig {
	hubUrl: string;
	facilityKey: string;
	mllpHost: string;
	mllpPort: number;
	queuePath: string;
	/** Downstream LIS for hub orders; null disables the outbox poller. */
	lis: { host: string; port: number } | null;
	outboxPollMs: number;
	retryBaseMs: number;
	retryMaxMs: number;
	hubTimeoutMs: number;
	lisTimeoutMs: number;
	/** HTTP health endpoint; null disables it. */
	healthPort: number | null;
	statusLogMs: number;
	logLevel: LogLevel;
	/** MSH-3/MSH-4 on ACKs that answer text with no MSH. */
	identity: { application: string; facility: string };
}

export class ConfigError extends Error {}

/** Reads the connector's configuration from the environment (see apps/connector/README.md). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ConnectorConfig {
	const errors: string[] = [];
	const required = (name: string): string => {
		const value = env[name]?.trim();
		if (!value) {
			errors.push(`${name} is required`);
		}
		return value ?? '';
	};
	const integer = (name: string, fallback: number, min = 0): number => {
		const raw = env[name]?.trim();
		if (!raw) {
			return fallback;
		}
		const value = Number(raw);
		if (!Number.isInteger(value) || value < min) {
			errors.push(`${name} must be an integer ≥ ${min}`);
			return fallback;
		}
		return value;
	};

	const hubUrl = required('HUB_URL');
	if (hubUrl) {
		try {
			const url = new URL(hubUrl);
			if (url.protocol !== 'https:' && url.protocol !== 'http:') {
				errors.push('HUB_URL must be an http(s) URL');
			}
		} catch {
			errors.push('HUB_URL must be a URL');
		}
	}
	const facilityKey = required('FACILITY_KEY');
	const lisHost = env.LIS_HOST?.trim();
	const healthPort = env.HEALTH_PORT?.trim() === 'off' ? null : integer('HEALTH_PORT', 8081);
	const logLevel = (env.LOG_LEVEL?.trim() || 'info') as LogLevel;
	if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
		errors.push('LOG_LEVEL must be debug, info, warn or error');
	}

	const config: ConnectorConfig = {
		hubUrl,
		facilityKey,
		mllpHost: env.MLLP_HOST?.trim() || '0.0.0.0',
		mllpPort: integer('MLLP_PORT', 2575),
		queuePath: env.QUEUE_PATH?.trim() || './data/connector.db',
		lis: lisHost ? { host: lisHost, port: integer('LIS_PORT', 2575, 1) } : null,
		outboxPollMs: integer('OUTBOX_POLL_MS', 5_000, 100),
		retryBaseMs: integer('RETRY_BASE_MS', 1_000, 1),
		retryMaxMs: integer('RETRY_MAX_MS', 5 * 60_000, 1),
		hubTimeoutMs: integer('HUB_TIMEOUT_MS', 15_000, 1),
		lisTimeoutMs: integer('LIS_TIMEOUT_MS', 15_000, 1),
		healthPort,
		statusLogMs: integer('STATUS_LOG_MS', 60_000),
		logLevel,
		identity: {
			application: env.CONNECTOR_APPLICATION?.trim() || 'LOOPWISE_CONNECTOR',
			facility: env.CONNECTOR_FACILITY?.trim() || '',
		},
	};
	if (config.retryMaxMs < config.retryBaseMs) {
		errors.push('RETRY_MAX_MS must be ≥ RETRY_BASE_MS');
	}
	if (errors.length > 0) {
		throw new ConfigError(`Invalid connector configuration: ${errors.join('; ')}`);
	}
	return config;
}

/** Plain HTTP to anything but this machine sends PHI in clear text. */
export function isInsecureHubUrl(hubUrl: string): boolean {
	const url = new URL(hubUrl);
	return url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}
