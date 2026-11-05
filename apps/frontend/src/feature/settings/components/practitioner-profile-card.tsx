import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { MyPractitionerQuery, SaveMyPractitionerInput } from '@/graphql/generated/graphql';
import styles from '@/feature/encounters/encounter.module.css';
import { FormField } from '@/feature/encounters/form-field';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/components/ui/settings-card';
import { encounterRecordApi } from '@/lib/encounter-record-api';

const FIELDS = [
	{ key: 'title', label: 'Title', placeholder: 'Dr. / Dra.' },
	{ key: 'postNominals', label: 'Post-nominals', placeholder: 'MD, FPCP' },
	{ key: 'specialty', label: 'Specialty', placeholder: 'Family medicine' },
	{ key: 'prcLicenseNo', label: 'PRC license number', placeholder: '0123456', required: true },
	{ key: 'prcLicenseExpiry', label: 'PRC license valid until', type: 'date' },
	{ key: 'ptrNo', label: 'PTR number', placeholder: '1234567' },
	{ key: 'ptrIssuedAt', label: 'PTR issued at', placeholder: 'Tagbilaran City' },
	{ key: 'ptrIssuedDate', label: 'PTR issued on', type: 'date' },
	{ key: 's2LicenseNo', label: 'S2 license number', placeholder: 'For dangerous drugs (RA 9165)' },
	{ key: 'philhealthPan', label: 'PhilHealth PAN', placeholder: 'Accreditation number' },
] as const satisfies readonly {
	key: keyof SaveMyPractitionerInput;
	label: string;
	placeholder?: string;
	type?: string;
	required?: boolean;
}[];

type Values = Record<(typeof FIELDS)[number]['key'], string>;

const valuesFrom = (practitioner: MyPractitionerQuery['myPractitioner']): Values =>
	Object.fromEntries(FIELDS.map(({ key }) => [key, practitioner?.[key] ?? ''])) as Values;

/**
 * Your practitioner profile: what prescriptions, medical certificates and referrals print about you. Writing them needs
 * the PRC license number; prescribing dangerous drugs also needs the S2 license.
 */
export function PractitionerProfileCard() {
	const queryClient = useQueryClient();
	const profile = useQuery(encounterRecordApi.encounterRecord.myPractitioner.queryOptions());
	const [values, setValues] = useState<Values>(() => valuesFrom(null));
	const save = useMutation(
		encounterRecordApi.encounterRecord.saveMyPractitioner.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries(encounterRecordApi.encounterRecord.myPractitioner.pathFilter()),
		}),
	);

	useEffect(() => {
		if (profile.data !== undefined) {
			setValues(valuesFrom(profile.data));
		}
	}, [profile.data]);

	const missingLicense = !values.prcLicenseNo.trim();
	return (
		<SettingsCard
			title='Practitioner profile'
			description={
				profile.data
					? `Printed as ${profile.data.displayName} on the prescriptions, certificates and referrals you sign.`
					: 'Printed on the prescriptions, certificates and referrals you sign. Writing them needs your PRC license number.'
			}
		>
			<form
				className={styles.section}
				onSubmit={(event) => {
					event.preventDefault();
					if (!missingLicense) {
						const text = (value: string) => value.trim() || null;
						save.mutate({
							title: text(values.title),
							postNominals: text(values.postNominals),
							specialty: text(values.specialty),
							prcLicenseNo: values.prcLicenseNo.trim(),
							prcLicenseExpiry: text(values.prcLicenseExpiry),
							ptrNo: text(values.ptrNo),
							ptrIssuedAt: text(values.ptrIssuedAt),
							ptrIssuedDate: text(values.ptrIssuedDate),
							s2LicenseNo: text(values.s2LicenseNo),
							philhealthPan: text(values.philhealthPan),
						});
					}
				}}
			>
				<div className={styles.fields}>
					{FIELDS.map((field) => (
						<FormField key={field.key} label={'required' in field ? `${field.label} *` : field.label}>
							{(id) => (
								<Input
									id={id}
									type={'type' in field ? field.type : 'text'}
									value={values[field.key]}
									placeholder={'placeholder' in field ? field.placeholder : undefined}
									onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
									disabled={profile.isPending || save.isPending}
									aria-required={'required' in field || undefined}
								/>
							)}
						</FormField>
					))}
				</div>
				{(profile.error ?? save.error) && <ErrorMessage message={(profile.error ?? save.error)!.message} />}
				<div className={styles.actions}>
					<Button type='submit' size='sm' variant='outline' disabled={save.isPending || missingLicense}>
						Save profile
					</Button>
					{save.isSuccess && <span className={styles.muted}>Saved.</span>}
				</div>
			</form>
		</SettingsCard>
	);
}
