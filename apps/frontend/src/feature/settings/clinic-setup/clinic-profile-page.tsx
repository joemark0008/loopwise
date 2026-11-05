import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import styles from './clinic-setup.module.css';
import { Field, LoadError, orNull } from './setup-form';
import type { CityMunicipality, ClinicSetupProfile } from '@/lib/clinic-setup-api';
import type { VatRegistration } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsCard } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { refetchClinicQueries } from '@/hooks/use-current-clinic';
import { clinicSetupApi } from '@/lib/clinic-setup-api';

/**
 * Settings → Clinic → Profile: the organization's legal details (what invoices print: registered name, TIN, VAT,
 * SEC / DTI, logo) and the clinic's own registrations (BIR branch code, DOH License to Operate, PhilHealth
 * accreditation), PSGC address and contact. Admins only; the organization's details need its admin or a super admin.
 */
export function ClinicProfilePage() {
	const profile = useQuery(clinicSetupApi.profile.queryOptions({}));
	if (profile.error) {
		return <LoadError message={profile.error.message} onRetry={() => void profile.refetch()} />;
	}
	if (!profile.data) {
		return <Skeleton className={styles.form} />;
	}
	return (
		<>
			<OrganizationCard key={`org-${profile.data.organization.id}`} profile={profile.data} />
			<ClinicCard key={`clinic-${profile.data.clinic.id}`} profile={profile.data} />
		</>
	);
}

type OrganizationValues = {
	name: string;
	tradeName: string;
	tin: string;
	vatRegistration: VatRegistration;
	secOrDtiNo: string;
	logoUrl: string;
};

function OrganizationCard({ profile }: { profile: ClinicSetupProfile }) {
	const queryClient = useQueryClient();
	const { organization, canEditOrganization } = profile;
	const initial = (): OrganizationValues => ({
		name: organization.name,
		tradeName: organization.tradeName ?? '',
		tin: organization.tin ?? '',
		vatRegistration: organization.vatRegistration,
		secOrDtiNo: organization.secOrDtiNo ?? '',
		logoUrl: organization.logoUrl ?? '',
	});
	const [values, setValues] = useState(initial);
	const save = useMutation(
		clinicSetupApi.updateOrganization.mutationOptions({
			onSuccess: (data) => queryClient.setQueryData(clinicSetupApi.profile.queryKey({}), data),
		}),
	);
	const set = (key: keyof OrganizationValues, value: string) => setValues({ ...values, [key]: value });
	const disabled = !canEditOrganization || save.isPending;

	return (
		<SettingsCard
			title='Organization'
			description={
				canEditOrganization
					? 'The registered business: printed on invoices and receipts (BIR).'
					: "Only the organization's admin or a super admin can change these."
			}
		>
			<form
				className={styles.form}
				aria-label='Organization'
				onSubmit={(event) => {
					event.preventDefault();
					save.mutate({
						name: values.name.trim(),
						tradeName: orNull(values.tradeName),
						tin: orNull(values.tin),
						vatRegistration: values.vatRegistration,
						secOrDtiNo: orNull(values.secOrDtiNo),
						logoUrl: orNull(values.logoUrl),
					});
				}}
			>
				<div className={styles.fields}>
					<Field label='Registered name' required hint='As on the DTI / SEC registration.'>
						{(id, describedBy) => (
							<Input
								id={id}
								aria-describedby={describedBy}
								value={values.name}
								onChange={(event) => set('name', event.target.value)}
								required
								disabled={disabled}
							/>
						)}
					</Field>
					<Field label='Trade name'>
						{(id) => (
							<Input
								id={id}
								value={values.tradeName}
								onChange={(event) => set('tradeName', event.target.value)}
								disabled={disabled}
							/>
						)}
					</Field>
					<Field label='TIN' hint='e.g. 123-456-789-000'>
						{(id, describedBy) => (
							<Input
								id={id}
								aria-describedby={describedBy}
								value={values.tin}
								inputMode='numeric'
								onChange={(event) => set('tin', event.target.value)}
								disabled={disabled}
							/>
						)}
					</Field>
					<Field label='BIR registration'>
						{(id) => (
							<Select
								value={values.vatRegistration}
								onValueChange={(value) => set('vatRegistration', value)}
								disabled={disabled}
							>
								<SelectTrigger id={id} aria-label='BIR registration'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='NON_VAT'>Non-VAT</SelectItem>
									<SelectItem value='VAT'>VAT-registered</SelectItem>
								</SelectContent>
							</Select>
						)}
					</Field>
					<Field label='SEC / DTI number'>
						{(id) => (
							<Input
								id={id}
								value={values.secOrDtiNo}
								onChange={(event) => set('secOrDtiNo', event.target.value)}
								disabled={disabled}
							/>
						)}
					</Field>
					<Field label='Logo URL' hint='https link to the logo printed on documents.'>
						{(id, describedBy) => (
							<Input
								id={id}
								type='url'
								aria-describedby={describedBy}
								value={values.logoUrl}
								onChange={(event) => set('logoUrl', event.target.value)}
								disabled={disabled}
							/>
						)}
					</Field>
				</div>
				{organization.logoUrl && <img className={styles.logo} src={organization.logoUrl} alt='Current logo' />}
				{save.error && <ErrorMessage message={save.error.message} />}
				{canEditOrganization && (
					<div className={styles.actions}>
						{save.isSuccess && (
							<span className={styles.muted} role='status'>
								Saved.
							</span>
						)}
						<Button type='submit' size='sm' disabled={disabled || !values.name.trim()}>
							Save organization
						</Button>
					</div>
				)}
			</form>
		</SettingsCard>
	);
}

type ClinicValues = {
	code: string;
	name: string;
	birBranchCode: string;
	dohLicenseNo: string;
	dohLicenseExpiry: string;
	philhealthAccreditNo: string;
	philhealthAccreditExp: string;
	addressLine: string;
	barangayCode: string;
	zipCode: string;
	contactNo: string;
	email: string;
	isActive: boolean;
};

type TextKey = Exclude<keyof ClinicValues, 'isActive'>;

const NO_BARANGAY = '__none__';

function ClinicCard({ profile }: { profile: ClinicSetupProfile }) {
	const queryClient = useQueryClient();
	const { clinic } = profile;
	const [values, setValues] = useState<ClinicValues>(() => ({
		code: clinic.code,
		name: clinic.name,
		birBranchCode: clinic.birBranchCode ?? '',
		dohLicenseNo: clinic.dohLicenseNo ?? '',
		dohLicenseExpiry: clinic.dohLicenseExpiry ?? '',
		philhealthAccreditNo: clinic.philhealthAccreditNo ?? '',
		philhealthAccreditExp: clinic.philhealthAccreditExp ?? '',
		addressLine: clinic.addressLine ?? '',
		barangayCode: clinic.barangayCode ?? '',
		zipCode: clinic.zipCode ?? '',
		contactNo: clinic.contactNo ?? '',
		email: clinic.email ?? '',
		isActive: clinic.isActive,
	}));
	const [city, setCity] = useState<Pick<CityMunicipality, 'code' | 'name' | 'provinceName'> | null>(
		clinic.cityMunicipalityCode
			? {
					code: clinic.cityMunicipalityCode,
					name: clinic.cityMunicipalityName ?? '',
					provinceName: clinic.provinceName,
				}
			: null,
	);
	const barangays = useQuery({
		...clinicSetupApi.barangays.queryOptions({ cityMunicipalityCode: city?.code ?? '' }),
		enabled: Boolean(city),
	});
	const save = useMutation(
		clinicSetupApi.updateClinic.mutationOptions({
			onSuccess: async (data) => {
				queryClient.setQueryData(clinicSetupApi.profile.queryKey({}), data);
				await refetchClinicQueries();
			},
		}),
	);
	const set = (key: TextKey, value: string) => setValues({ ...values, [key]: value });
	const disabled = save.isPending;
	const text = (key: TextKey, label: string, options: { hint?: string; type?: string; required?: boolean } = {}) => (
		<Field label={label} hint={options.hint} required={options.required}>
			{(id, describedBy) => (
				<Input
					id={id}
					type={options.type ?? 'text'}
					aria-describedby={describedBy}
					value={values[key]}
					onChange={(event) => set(key, event.target.value)}
					required={options.required}
					disabled={disabled}
				/>
			)}
		</Field>
	);

	return (
		<SettingsCard title='Clinic' description='This branch: its registrations, address and contact.'>
			<form
				className={styles.form}
				aria-label='Clinic'
				onSubmit={(event) => {
					event.preventDefault();
					save.mutate({
						code: values.code.trim().toUpperCase(),
						name: values.name.trim(),
						birBranchCode: orNull(values.birBranchCode),
						dohLicenseNo: orNull(values.dohLicenseNo),
						dohLicenseExpiry: orNull(values.dohLicenseExpiry),
						philhealthAccreditNo: orNull(values.philhealthAccreditNo),
						philhealthAccreditExp: orNull(values.philhealthAccreditExp),
						addressLine: orNull(values.addressLine),
						cityMunicipalityCode: city?.code ?? null,
						barangayCode: city ? orNull(values.barangayCode) : null,
						zipCode: orNull(values.zipCode),
						contactNo: orNull(values.contactNo),
						email: orNull(values.email),
						isActive: values.isActive,
					});
				}}
			>
				<fieldset className={styles.fieldset}>
					<legend className={styles.legend}>Identity</legend>
					<div className={styles.fields}>
						{text('name', 'Clinic name', { required: true })}
						{text('code', 'Code', {
							required: true,
							hint: 'Printed in document numbers (TAG-RX-…). Changing it applies to new sequences.',
						})}
						{text('birBranchCode', 'BIR branch code', { hint: '3–5 digits; 00000 for the head office.' })}
					</div>
				</fieldset>
				<fieldset className={styles.fieldset}>
					<legend className={styles.legend}>Licenses and accreditation</legend>
					<div className={styles.fields}>
						{text('dohLicenseNo', 'DOH License to Operate no.')}
						{text('dohLicenseExpiry', 'DOH license valid until', { type: 'date' })}
						{text('philhealthAccreditNo', 'PhilHealth accreditation no.')}
						{text('philhealthAccreditExp', 'PhilHealth accreditation valid until', { type: 'date' })}
					</div>
				</fieldset>
				<fieldset className={styles.fieldset}>
					<legend className={styles.legend}>Address and contact</legend>
					<div className={styles.fields}>
						{text('addressLine', 'Street and building')}
						<CityPicker
							value={city}
							disabled={disabled}
							onChange={(next) => {
								setCity(next);
								setValues({ ...values, barangayCode: '', zipCode: next?.zipCode ?? values.zipCode });
							}}
						/>
						<Field label='Barangay' hint={city ? undefined : 'Pick the city or municipality first.'}>
							{(id, describedBy) => (
								<Select
									value={values.barangayCode || NO_BARANGAY}
									onValueChange={(value) => set('barangayCode', value === NO_BARANGAY ? '' : value)}
									disabled={disabled || !city}
								>
									<SelectTrigger id={id} aria-label='Barangay' aria-describedby={describedBy}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NO_BARANGAY}>Not set</SelectItem>
										{(barangays.data ?? []).map((barangay) => (
											<SelectItem key={barangay.code} value={barangay.code}>
												{barangay.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</Field>
						{text('zipCode', 'ZIP code')}
						{text('contactNo', 'Contact number')}
						{text('email', 'Email', { type: 'email' })}
					</div>
					<label className={styles.checkboxRow}>
						<Checkbox
							checked={values.isActive}
							onCheckedChange={(checked) => setValues({ ...values, isActive: checked })}
							disabled={disabled}
						/>
						Active (open for visits)
					</label>
				</fieldset>
				{save.error && <ErrorMessage message={save.error.message} />}
				<div className={styles.actions}>
					{save.isSuccess && (
						<span className={styles.muted} role='status'>
							Saved.
						</span>
					)}
					<Button type='submit' size='sm' disabled={disabled || !values.name.trim() || !values.code.trim()}>
						Save clinic
					</Button>
				</div>
			</form>
		</SettingsCard>
	);
}

/** The PSGC city or municipality: search by name, pick one; "Change" searches again. */
function CityPicker({
	value,
	disabled,
	onChange,
}: {
	value: Pick<CityMunicipality, 'code' | 'name' | 'provinceName'> | null;
	disabled: boolean;
	onChange: (city: CityMunicipality | null) => void;
}) {
	const [search, setSearch] = useState('');
	const [debounced, setDebounced] = useState('');
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(search.trim()), 250);
		return () => clearTimeout(timer);
	}, [search]);
	const results = useQuery({
		...clinicSetupApi.cityMunicipalities.queryOptions({ query: debounced }),
		enabled: !value && debounced.length >= 2,
	});

	return (
		<Field label='City / municipality' hint={value ? undefined : 'Type at least 2 letters of the name.'}>
			{(id, describedBy) =>
				value ? (
					<div className={styles.toolbarStart}>
						<span className={styles.selected} id={id}>
							{value.name}
							{value.provinceName ? `, ${value.provinceName}` : ''}
						</span>
						<Button
							type='button'
							variant='ghost'
							size='sm'
							disabled={disabled}
							onClick={() => onChange(null)}
						>
							Change
						</Button>
					</div>
				) : (
					<>
						<Input
							id={id}
							type='search'
							aria-describedby={describedBy}
							value={search}
							placeholder='Search cities and municipalities'
							onChange={(event) => setSearch(event.target.value)}
							disabled={disabled}
						/>
						{(results.data ?? []).length > 0 && (
							<div className={styles.options} role='listbox' aria-label='Cities and municipalities'>
								{results.data!.map((city) => (
									<button
										key={city.code}
										type='button'
										role='option'
										aria-selected={false}
										className={styles.option}
										onClick={() => {
											setSearch('');
											onChange(city);
										}}
									>
										<span>{city.name}</span>
										<span className={styles.muted}>{city.provinceName}</span>
									</button>
								))}
							</div>
						)}
					</>
				)
			}
		</Field>
	);
}
