import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import type { GraphQLContext } from '../graphql-context.js';

/** The request's DataLoaders: `@Loaders() loaders: RequestLoaders` → `loaders.get(UserLoader).load(id)`. */
export const Loaders = createParamDecorator(
	(_data: unknown, context: ExecutionContext) =>
		GqlExecutionContext.create(context).getContext<GraphQLContext>().loaders,
);
