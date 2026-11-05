import { ConsoleLogger } from '@nestjs/common';

import { currentRequestContext } from './request-context.js';

/**
 * Nest's console logger with the request's correlation id (and user, once known) after the context name, so every
 * `new Logger(Foo.name).log(...)` written while serving a request can be traced back to it: `[FooService] [req:… user:…]`.
 * Installed in `main.ts`; outside a request the output is Nest's own.
 */
export class RequestContextLogger extends ConsoleLogger {
	protected override formatContext(context: string): string {
		const base = super.formatContext(context);
		const request = currentRequestContext();
		if (!request) {
			return base;
		}
		const user = request.userId ? ` user:${request.userId}` : '';
		const tag = `[req:${request.requestId}${user}] `;
		return this.options.colors === false || !base ? `${base}${tag}` : `${base}${this.colorize(tag, 'debug')}`;
	}
}
