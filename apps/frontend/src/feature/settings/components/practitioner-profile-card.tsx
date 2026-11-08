import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { MyPractitionerQuery, SaveMyPractitionerInput } from '@/graphql/generated/graphql';
import styles from '@/feature/encounters/encounter.module.css';
import { FormField } from '@/feature/encounters/form-field';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { cn } from '@/lib/utils';

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

/** Four fields a row on a wide screen; the fields of a short last row share its full width. */
const COLUMNS = 4;
const LAST_ROW_SPAN: Record<number, string> = { 1: 'lg:col-span-4', 2: 'lg:col-span-2' };

function lastRowSpan(index: number): string | undefined {
	const remainder = FIELDS.length % COLUMNS;
	if (remainder === 0 || index < FIELDS.length - remainder) {
		return undefined;
	}
	// Three left over: the last one takes the fourth column too.
	return remainder === 3 ? (index === FIELDS.length - 1 ? 'lg:col-span-2' : undefined) : LAST_ROW_SPAN[remainder];
}

type Values = Record<(typeof FIELDS)[number]['key'], string>;

const valuesFrom = (practitioner: MyPractitionerQuery['myPractitioner']): Values =>
	Object.fromEntries(FIELDS.map(({ key }) => [key, practitioner?.[key] ?? ''])) as Values;

/**
 * Your practitioner profile: what prescriptions, medical certificates and referrals print about you. Writing them needs
 * the PRC license number; prescribing dangerous drugs also needs the S2 license.
 */
export function PractitionerProfileCard() {
	const profile = useQuery(encounterRecordApi.encounterRecord.myPractitioner.queryOptions());
	return (
		<SettingsCard
			title='Practitioner profile'
			description={
				profile.data
					? `Printed as ${profile.data.displayName} on the prescriptions, certificates and referrals you sign.`
					: 'Printed on the prescriptions, certificates and referrals you sign. Writing them needs your PRC license number.'
			}
		>
			{profile.error ? (
				<ErrorMessage message={profile.error.message} />
			) : profile.data === undefined ? (
				<Skeleton />
			) : (
				<PractitionerProfileForm practitioner={profile.data} />
			)}
		</SettingsCard>
	);
}

/**
 * The form starts from the loaded profile and is only shown once it has loaded, so a late or background fetch never
 * overwrites what the user is typing.
 */
function PractitionerProfileForm({ practitioner }: { practitioner: MyPractitionerQuery['myPractitioner'] }) {
	const queryClient = useQueryClient();
	const [values, setValues] = useState<Values>(() => valuesFrom(practitioner));
	const save = useMutation(
		encounterRecordApi.encounterRecord.saveMyPractitioner.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries(encounterRecordApi.encounterRecord.myPractitioner.pathFilter()),
		}),
	);

	const missingLicense = !values.prcLicenseNo.trim();
	return (
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
			<div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
				{FIELDS.map((field, index) => (
					<div key={field.key} className={cn('min-w-0', lastRowSpan(index))}>
						<FormField label={'required' in field ? `${field.label} *` : field.label}>
							{(id) => (
								<Input
									id={id}
									type={'type' in field ? field.type : 'text'}
									value={values[field.key]}
									placeholder={'placeholder' in field ? field.placeholder : undefined}
									onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
									disabled={save.isPending}
									aria-required={'required' in field || undefined}
								/>
							)}
						</FormField>
					</div>
				))}
			</div>
			{save.error && <ErrorMessage message={save.error.message} />}
			<div className={styles.actions}>
				<Button type='submit' size='sm' variant='outline' disabled={save.isPending || missingLicense}>
					Save profile
				</Button>
				{save.isSuccess && <span className={styles.muted}>Saved.</span>}
			</div>
		</form>
	);
}
