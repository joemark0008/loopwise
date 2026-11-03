import type { UserPreferences } from '@quarry/shared/types';

import { UpdateUserPreferencesDocument, UserPreferencesDocument } from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

/** The signed-in user's preferences (upstream `user.getPreferences` / `updatePreferences`), on apps/api. */
export const userApi = {
	user: {
		getPreferences: query<void, UserPreferences>(
			['user', 'getPreferences'],
			async () => (await runQuery(UserPreferencesDocument, {})).userPreferences as UserPreferences,
		),
		updatePreferences: mutation<UserPreferences, UserPreferences>(
			['user', 'updatePreferences'],
			async (input) =>
				(await runMutation(UpdateUserPreferencesDocument, { input })).updateUserPreferences as UserPreferences,
		),
	},
};
