import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsCard } from '@/components/ui/settings-card';
import { SettingsControlRow } from '@/components/ui/settings-toggle-row';
import { Switch } from '@/components/ui/switch';
import { memoryApi } from '@/lib/memory-api';
import { clinicApi } from '@/lib/clinic-api';

export function SettingsClinicMemory() {
	const queryClient = useQueryClient();
	const clinicMemorySettings = useQuery(memoryApi.clinic.getMemorySettings.queryOptions());

	const updateClinicMemory = useMutation(
		clinicApi.clinic.updateAgentSettings.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: memoryApi.clinic.getMemorySettings.queryOptions().queryKey,
				});
			},
		}),
	);

	const clinicMemoryEnabled = clinicMemorySettings.data?.memoryEnabled ?? true;

	const handleClinicToggle = (enabled: boolean) => {
		updateClinicMemory.mutate({ memoryEnabled: enabled });
	};

	return (
		<SettingsCard
			title='Clinic memory'
			description='Controls memory for everyone in this clinic. When off, no member can use memory.'
			divide
		>
			<SettingsControlRow
				id='clinic-memory'
				label='Enable memory for this clinic'
				description='Allow members to use personal memory.'
				control={
					<Switch
						id='clinic-memory'
						checked={clinicMemoryEnabled}
						onCheckedChange={handleClinicToggle}
						disabled={updateClinicMemory.isPending}
					/>
				}
			/>
		</SettingsCard>
	);
}
