import { Logger } from '@nestjs/common';

/**
 * Upstream `utils/logger.ts` API on Nest's logger. Upstream also stored each entry in the `log` table for the
 * admin Logs page; that moves with the `usage` module (Phase 6).
 */
export interface LogOptions {
	source: string;
	projectId?: string;
	context?: Record<string, unknown>;
}

const nestLogger = new Logger('Agent');

const format = (message: string, opts: LogOptions) =>
	`[${opts.source}]${opts.projectId ? ` [project ${opts.projectId}]` : ''} ${message}${
		opts.context ? ` ${JSON.stringify(opts.context)}` : ''
	}`;

export const logger = {
	error: (message: string, opts: LogOptions) => nestLogger.error(format(message, opts)),
	warn: (message: string, opts: LogOptions) => nestLogger.warn(format(message, opts)),
	info: (message: string, opts: LogOptions) => nestLogger.log(format(message, opts)),
	debug: (message: string, opts: LogOptions) => nestLogger.debug(format(message, opts)),
};
