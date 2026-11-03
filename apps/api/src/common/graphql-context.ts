import type { Response } from 'express';

import type { RequestLoaders } from './dataloader/request-loaders.js';
import type { QuarryRequest } from './request.js';

export interface GraphQLContext {
	req: QuarryRequest;
	res: Response;
	loaders: RequestLoaders;
}
