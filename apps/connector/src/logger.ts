/**
 * JSON-lines logs. Callers pass control ids, counts and statuses only: never a message body, an ACK body or any other
 * field that can carry patient data (PHI).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
	debug(event: string, fields?: LogFields): void;
	info(event: string, fields?: LogFields): void;
	warn(event: string, fields?: LogFields): void;
	error(event: string, fields?: LogFields): void;
}

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(
	level: LogLevel = 'info',
	write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
): Logger {
	const log =
		(entryLevel: LogLevel) =>
		(event: string, fields: LogFields = {}) => {
			if (LEVELS[entryLevel] < LEVELS[level]) {
				return;
			}
			write(JSON.stringify({ time: new Date().toISOString(), level: entryLevel, event, ...fields }));
		};
	return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}

export const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

/** Error text for logs, cut short: an upstream error message can echo what it was sent. */
export function errorText(error: unknown): string {
	const text = error instanceof Error ? error.message : String(error);
	return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}
