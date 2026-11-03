import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import styles from '@/feature/encounters/encounter.module.css';
import { FormField } from '@/feature/encounters/form-field';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/components/ui/settings-card';
import { encounterRecordApi } from '@/lib/encounter-record-api';

const FIELDS = [
	{ key: 'credentials', label: 'Credentials', placeholder: 'MD' },
	{ key: 'specialty', label: 'Specialty', placeholder: 'Family medicine' },
	{ key: 'prcLicenseNumber', label: 'PRC license number', placeholder: '0123456' },
	{ key: 'ptrNumber', label: 'PTR number', placeholder: '1234567' },
] as const;

type Values = Record<(typeof FIELDS)[number]['key'], string>;

/** What prescriptions and medical certificates print about you; issuing them needs the PRC license number. */
export function ClinicianProfileCard() {
	const queryClient = useQueryClient();
	const profile = useQuery(encounterRecordApi.encounterRecord.clinicianProfile.queryOptions());
	const [values, setValues] = useState<Values>({
		credentials: '',
		specialty: '',
		prcLicenseNumber: '',
		ptrNumber: '',
	});
	const save = useMutation(
		encounterRecordApi.encounterRecord.updateClinicianProfile.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries(encounterRecordApi.encounterRecord.clinicianProfile.pathFilter()),
		}),
	);

	useEffect(() => {
		if (profile.data) {
			setValues({
				credentials: profile.data.credentials ?? '',
				specialty: profile.data.specialty ?? '',
				prcLicenseNumber: profile.data.prcLicenseNumber ?? '',
				ptrNumber: profile.data.ptrNumber ?? '',
			});
		}
	}, [profile.data]);

	return (
		<SettingsCard
			title='Clinician profile'
			description='Printed on the prescriptions and medical certificates you issue. Issuing needs your PRC license number.'
		>
			<form
				className={styles.section}
				onSubmit={(event) => {
					event.preventDefault();
					save.mutate(values);
				}}
			>
				<div className={styles.fields}>
					{FIELDS.map(({ key, label, placeholder }) => (
						<FormField key={key} label={label}>
							{(id) => (
								<Input
									id={id}
									value={values[key]}
									placeholder={placeholder}
									onChange={(event) => setValues({ ...values, [key]: event.target.value })}
									disabled={profile.isPending || save.isPending}
								/>
							)}
						</FormField>
					))}
				</div>
				{(profile.error ?? save.error) && <ErrorMessage message={(profile.error ?? save.error)!.message} />}
				<div className={styles.actions}>
					<Button type='submit' size='sm' variant='outline' disabled={save.isPending}>
						Save profile
					</Button>
					{save.isSuccess && <span className={styles.muted}>Saved.</span>}
				</div>
			</form>
		</SettingsCard>
	);
}
