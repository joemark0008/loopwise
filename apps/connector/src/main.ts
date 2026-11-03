import { ConfigError, loadConfig } from './config.ts';
import { startConnector } from './connector.ts';
import { createLogger, errorText } from './logger.ts';

/** Entry point: `npm start -w @loopwise/connector` (or the Docker image). Stops cleanly on SIGINT / SIGTERM. */
async function main(): Promise<void> {
	let config;
	try {
		config = loadConfig();
	} catch (error) {
		if (error instanceof ConfigError) {
			createLogger().error('config.invalid', { error: error.message });
			process.exit(2);
		}
		throw error;
	}
	const logger = createLogger(config.logLevel);
	const connector = await startConnector(config, { logger });

	let signals = 0;
	const shutdown = (signal: string) => {
		signals += 1;
		if (signals > 1) {
			logger.warn('connector.forced_exit', { signal });
			process.exit(1);
		}
		logger.info('connector.signal', { signal });
		connector.stop().then(
			() => process.exit(0),
			(error) => {
				logger.error('connector.stop_failed', { error: errorText(error) });
				process.exit(1);
			},
		);
	};
	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
	createLogger().error('connector.crashed', { error: errorText(error) });
	process.exit(1);
});
