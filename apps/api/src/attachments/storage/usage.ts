import { getStorage, isStorageEnabled } from './index.js';
import { clinicRoot, scopeRoot, userIdFromKey } from './keys.js';
import type { StorageObject, StorageScope } from './types.js';

export interface StorageUsage {
	fileCount: number;
	totalBytes: number;
}

export interface UserStorageUsage extends StorageUsage {
	userId: string;
}

/** What one user keeps in one clinic. */
export const getScopeUsage = async (scope: StorageScope): Promise<StorageUsage> => {
	if (!isStorageEnabled()) {
		return emptyUsage();
	}

	return sumUsage(await getStorage().list(scopeRoot(scope)));
};

/** What every user of a clinic keeps, heaviest space first. */
export const getClinicUsageByUser = async (clinicId: string): Promise<UserStorageUsage[]> => {
	if (!isStorageEnabled()) {
		return [];
	}

	const usageByUser = new Map<string, UserStorageUsage>();

	for (const object of await getStorage().list(clinicRoot(clinicId))) {
		const userId = userIdFromKey(object.key);
		if (!userId) {
			continue;
		}

		const usage = usageByUser.get(userId) ?? { userId, ...emptyUsage() };
		usage.fileCount += 1;
		usage.totalBytes += object.size;
		usageByUser.set(userId, usage);
	}

	return [...usageByUser.values()].sort((a, b) => b.totalBytes - a.totalBytes);
};

const sumUsage = (objects: StorageObject[]): StorageUsage => {
	return {
		fileCount: objects.length,
		totalBytes: objects.reduce((total, object) => total + object.size, 0),
	};
};

const emptyUsage = (): StorageUsage => ({ fileCount: 0, totalBytes: 0 });
