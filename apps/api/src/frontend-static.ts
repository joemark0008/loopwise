import { existsSync } from 'node:fs';
import path from 'node:path';

import express from 'express';

/** Paths the API answers itself; everything else is the frontend's (the Vite proxy in development). */
const API_PATHS = ['/graphql', '/api', '/health', '/i', '/c'];

/**
 * Serves the built frontend from the API (the production image): its assets, and `index.html` for every other
 * GET so client-side routes load on refresh. Hashed assets are cached for a year, `index.html` never.
 */
export function serveFrontend(app: { use(...handlers: unknown[]): unknown }, distDir: string): void {
	const root = path.resolve(distDir);
	const indexHtml = path.join(root, 'index.html');
	if (!existsSync(indexHtml)) {
		throw new Error(`LOOPWISE_FRONTEND_DIST has no index.html: ${root}`);
	}

	app.use('/assets', express.static(path.join(root, 'assets'), { immutable: true, maxAge: '1y' }));
	app.use(express.static(root, { index: false }));
	app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
		const isApiPath = API_PATHS.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`));
		if ((req.method !== 'GET' && req.method !== 'HEAD') || isApiPath) {
			next();
			return;
		}
		res.setHeader('Cache-Control', 'no-cache');
		res.sendFile(indexHtml);
	});
}
