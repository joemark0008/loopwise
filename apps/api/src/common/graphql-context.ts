import type { Response } from 'express';

import type { RequestLoaders } from './dataloader/request-loaders.js';
import type { LoopwiseRequest } from './request.js';

export interface GraphQLContext {
	req: LoopwiseRequest;
	res: Response;
	loaders: RequestLoaders;
}
