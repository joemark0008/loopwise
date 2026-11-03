import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationOptions } from '@tanstack/react-query';
import { encounterApi } from '@/lib/encounter-api';
import { encounterRecordApi } from '@/lib/encounter-record-api';

/** A write to the encounter record: on success the record (and the chart's encounter list) is read again. */
export function useRecordMutation<TInput, TOutput>(procedure: {
	mutationOptions: (
		opts?: Omit<UseMutationOptions<TOutput, Error, TInput>, 'mutationFn' | 'mutationKey'>,
	) => UseMutationOptions<TOutput, Error, TInput>;
}) {
	const queryClient = useQueryClient();
	return useMutation(
		procedure.mutationOptions({
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries(encounterRecordApi.encounterRecord.get.pathFilter()),
					queryClient.invalidateQueries(encounterApi.encounter.list.pathFilter()),
				]),
		}),
	);
}
