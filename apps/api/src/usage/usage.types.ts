import type { USAGE_SOURCES } from '@quarry/shared/usage';

import type { MESSAGE_SOURCES } from '../agent/types/chat.js';

/** Upstream `types/usage.ts` lives in `@quarry/shared/usage`, which the usage page shares. */
export * from '@quarry/shared/usage';

// The usage sources must stay the chat message sources.
type SameSources = [(typeof MESSAGE_SOURCES)[number]] extends [(typeof USAGE_SOURCES)[number]]
	? [(typeof USAGE_SOURCES)[number]] extends [(typeof MESSAGE_SOURCES)[number]]
		? true
		: never
	: never;
export const USAGE_SOURCES_MATCH_MESSAGE_SOURCES: SameSources = true;
