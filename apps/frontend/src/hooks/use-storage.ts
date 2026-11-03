import { useQuery } from '@tanstack/react-query';

import { storageApi } from '@/lib/storage-api';

export function useStorageConfig({ enabled = true }: { enabled?: boolean } = {}) {
	return useQuery({ ...storageApi.storage.getConfig.queryOptions(), enabled });
}

export function useStorageHealth({ enabled = true }: { enabled?: boolean } = {}) {
	return useQuery({ ...storageApi.storage.getHealth.queryOptions(), enabled });
}

export function useStorageUploadLimits() {
	return useQuery(storageApi.storage.getUploadLimits.queryOptions());
}

export function useStorageUsage({ enabled = true }: { enabled?: boolean } = {}) {
	return useQuery({ ...storageApi.storage.getUsage.queryOptions(), enabled });
}
