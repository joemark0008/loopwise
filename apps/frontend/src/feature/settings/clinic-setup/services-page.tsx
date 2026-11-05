import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import styles from './clinic-setup.module.css';
import { Field, LoadError, numberOrNull, peso } from './setup-form';
import type { ServiceCatalogItem } from '@/lib/clinic-setup-api';
import type { ServiceCategory, TaxType } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsCard } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { clinicSetupApi } from '@/lib/clinic-setup-api';

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
	CONSULTATION: 'Consultation',
	PROFESSIONAL_FEE: 'Professional fee',
	PROCEDURE: 'Procedure',
	LABORATORY: 'Laboratory',
	IMAGING: 'Imaging',
	MEDICINE: 'Medicine',
	SUPPLY: 'Supply',
	VACCINE: 'Vaccine',
	PACKAGE: 'Package',
	CERTIFICATE: 'Certificate',
	OTHER: 'Other',
};

const TAX_LABELS: Record<TaxType, string> = {
	VAT_EXEMPT: 'VAT-exempt',
	VATABLE: 'VATable (12% included)',
	ZERO_RATED: 'Zero-rated',
};

const NONE = '__none__';

/**
 * Settings → Clinic → Services: the organization's catalog of chargeable services (code, category, default price, tax
 * type, professional-fee share, the test or inventory item billed) with this clinic's own price and HMO rate. The
 * cashier's invoice lines are priced from it.
 */
export function ServicesPage() {
	const [includeInactive, setIncludeInactive] = useState(false);
	const [search, setSearch] = useState('');
	const [editing, setEditing] = useState<ServiceCatalogItem | 'new' | null>(null);
	const [pricing, setPricing] = useState<ServiceCatalogItem | null>(null);
	const services = useQuery(clinicSetupApi.services.queryOptions({ includeInactive }));
	const rows = useMemo(() => {
		const text = search.trim().toLowerCase();
		return (services.data ?? []).filter(
			(item) => !text || item.name.toLowerCase().includes(text) || item.code.toLowerCase().includes(text),
		);
	}, [services.data, search]);

	return (
		<SettingsCard
			title='Services and prices'
			description="The organization's price list, with this clinic's own prices. Invoices are priced from it."
		>
			<div className={styles.form}>
				<div className={styles.toolbar}>
					<div className={styles.toolbarStart}>
						<Input
							className={styles.search}
							type='search'
							aria-label='Search services'
							placeholder='Search by name or code'
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
						<label className={styles.checkboxRow}>
							<Checkbox checked={includeInactive} onCheckedChange={setIncludeInactive} />
							Show inactive
						</label>
					</div>
					<Button size='sm' onClick={() => setEditing('new')}>
						Add service
					</Button>
				</div>
				{services.error ? (
					<LoadError message={services.error.message} onRetry={() => void services.refetch()} />
				) : !services.data ? (
					<Skeleton className={styles.form} />
				) : rows.length === 0 ? (
					<EmptyState title={search ? 'No service matches' : 'No services yet'}>
						{search ? 'Try another name or code.' : 'Add the services the clinic charges for.'}
					</EmptyState>
				) : (
					<div className={styles.tableScroll}>
						<table className={styles.table}>
							<thead>
								<tr>
									<th scope='col'>Code</th>
									<th scope='col'>Service</th>
									<th scope='col'>Category</th>
									<th scope='col' data-numeric>
										Default
									</th>
									<th scope='col' data-numeric>
										This clinic
									</th>
									<th scope='col' data-numeric>
										HMO
									</th>
									<th scope='col'>
										<span className='sr-only'>Actions</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((item) => (
									<tr key={item.id} data-inactive={!item.isActive || undefined}>
										<td className={styles.code}>{item.code}</td>
										<td>
											{item.name}
											{!item.isActive && <span className={styles.muted}> (inactive)</span>}
											{(item.diagnosticTestName ?? item.inventoryItemName) && (
												<div className={styles.muted}>
													Bills {item.diagnosticTestName ?? item.inventoryItemName}
												</div>
											)}
										</td>
										<td>{CATEGORY_LABELS[item.category]}</td>
										<td
											data-numeric
											className={item.clinicPrice != null ? styles.strike : undefined}
										>
											{peso(item.defaultPrice)}
										</td>
										<td data-numeric>{item.clinicPrice != null ? peso(item.clinicPrice) : '—'}</td>
										<td data-numeric>{peso(item.hmoPrice)}</td>
										<td>
											<div className={styles.rowActions}>
												<Button
													variant='ghost'
													size='sm'
													aria-label={`Edit ${item.name}`}
													onClick={() => setEditing(item)}
												>
													Edit
												</Button>
												<Button
													variant='ghost'
													size='sm'
													aria-label={`Clinic price of ${item.name}`}
													onClick={() => setPricing(item)}
												>
													Price
												</Button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
			<ServiceDialog item={editing} onClose={() => setEditing(null)} />
			<PriceDialog item={pricing} onClose={() => setPricing(null)} />
		</SettingsCard>
	);
}

type ServiceValues = {
	code: string;
	name: string;
	category: ServiceCategory;
	defaultPrice: string;
	taxType: TaxType;
	isPfShareable: boolean;
	diagnosticTestId: string;
	inventoryItemId: string;
	isActive: boolean;
};

function ServiceDialog({ item, onClose }: { item: ServiceCatalogItem | 'new' | null; onClose: () => void }) {
	return (
		<Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				{item && <ServiceForm key={item === 'new' ? 'new' : item.id} item={item} onDone={onClose} />}
			</DialogContent>
		</Dialog>
	);
}

function ServiceForm({ item, onDone }: { item: ServiceCatalogItem | 'new'; onDone: () => void }) {
	const queryClient = useQueryClient();
	const existing = item === 'new' ? null : item;
	const [values, setValues] = useState<ServiceValues>(() => ({
		code: existing?.code ?? '',
		name: existing?.name ?? '',
		category: existing?.category ?? 'CONSULTATION',
		defaultPrice: existing ? String(existing.defaultPrice) : '',
		taxType: existing?.taxType ?? 'VAT_EXEMPT',
		isPfShareable: existing?.isPfShareable ?? false,
		diagnosticTestId: existing?.diagnosticTestId ?? '',
		inventoryItemId: existing?.inventoryItemId ?? '',
		isActive: existing?.isActive ?? true,
	}));
	const options = useQuery(clinicSetupApi.serviceLinkOptions.queryOptions({}));
	const save = useMutation(
		clinicSetupApi.saveService.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries(clinicSetupApi.services.pathFilter());
				await queryClient.invalidateQueries(clinicSetupApi.serviceLinkOptions.pathFilter());
				onDone();
			},
		}),
	);
	const set = <K extends keyof ServiceValues>(key: K, value: ServiceValues[K]) =>
		setValues({ ...values, [key]: value });
	const price = numberOrNull(values.defaultPrice);
	const valid = values.code.trim() && values.name.trim() && price !== null && price >= 0;
	const linkable = <T extends { id: string; linkedServiceItemId: string | null }>(rows: readonly T[]) =>
		rows.filter((row) => !row.linkedServiceItemId || row.linkedServiceItemId === existing?.id);

	return (
		<form
			className={styles.form}
			onSubmit={(event) => {
				event.preventDefault();
				if (!valid) {
					return;
				}
				save.mutate({
					id: existing?.id ?? null,
					code: values.code.trim().toUpperCase(),
					name: values.name.trim(),
					category: values.category,
					defaultPrice: price,
					taxType: values.taxType,
					isPfShareable: values.isPfShareable,
					diagnosticTestId: values.diagnosticTestId || null,
					inventoryItemId: values.inventoryItemId || null,
					isActive: values.isActive,
				});
			}}
		>
			<DialogHeader>
				<DialogTitle>{existing ? `Edit ${existing.name}` : 'Add a service'}</DialogTitle>
				<DialogDescription>Part of the organization's catalog, at every clinic.</DialogDescription>
			</DialogHeader>
			<div className={styles.fields}>
				<Field label='Code' required hint="Capital letters, digits and '-'.">
					{(id, describedBy) => (
						<Input
							id={id}
							aria-describedby={describedBy}
							value={values.code}
							onChange={(event) => set('code', event.target.value.toUpperCase())}
							required
						/>
					)}
				</Field>
				<Field label='Name' required>
					{(id) => (
						<Input
							id={id}
							value={values.name}
							onChange={(event) => set('name', event.target.value)}
							required
						/>
					)}
				</Field>
				<Field label='Category'>
					{(id) => (
						<Select
							value={values.category}
							onValueChange={(value) => set('category', value as ServiceCategory)}
						>
							<SelectTrigger id={id} aria-label='Category'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(CATEGORY_LABELS).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>
				<Field label='Default price (₱)' required>
					{(id) => (
						<Input
							id={id}
							type='number'
							min={0}
							step='0.01'
							inputMode='decimal'
							value={values.defaultPrice}
							onChange={(event) => set('defaultPrice', event.target.value)}
							required
						/>
					)}
				</Field>
				<Field label='Tax'>
					{(id) => (
						<Select value={values.taxType} onValueChange={(value) => set('taxType', value as TaxType)}>
							<SelectTrigger id={id} aria-label='Tax'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(TAX_LABELS).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>
				<Field label='Bills lab / imaging test'>
					{(id) => (
						<Select
							value={values.diagnosticTestId || NONE}
							onValueChange={(value) => set('diagnosticTestId', value === NONE ? '' : value)}
						>
							<SelectTrigger id={id} aria-label='Bills lab or imaging test'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>None</SelectItem>
								{linkable(options.data?.diagnosticTests ?? []).map((test) => (
									<SelectItem key={test.id} value={test.id}>
										{test.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>
				<Field label='Bills inventory item'>
					{(id) => (
						<Select
							value={values.inventoryItemId || NONE}
							onValueChange={(value) => set('inventoryItemId', value === NONE ? '' : value)}
						>
							<SelectTrigger id={id} aria-label='Bills inventory item'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>None</SelectItem>
								{linkable(options.data?.inventoryItems ?? []).map((inventoryItem) => (
									<SelectItem key={inventoryItem.id} value={inventoryItem.id}>
										{inventoryItem.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>
			</div>
			<label className={styles.checkboxRow}>
				<Checkbox checked={values.isPfShareable} onCheckedChange={(checked) => set('isPfShareable', checked)} />
				Part goes to the practitioner (professional fee)
			</label>
			<label className={styles.checkboxRow}>
				<Checkbox checked={values.isActive} onCheckedChange={(checked) => set('isActive', checked)} />
				Active (offered on invoices)
			</label>
			{save.error && <ErrorMessage message={save.error.message} />}
			<DialogFooter>
				<Button type='button' variant='outline' size='sm' onClick={onDone}>
					Cancel
				</Button>
				<Button type='submit' size='sm' disabled={!valid || save.isPending}>
					{existing ? 'Save service' : 'Add service'}
				</Button>
			</DialogFooter>
		</form>
	);
}

function PriceDialog({ item, onClose }: { item: ServiceCatalogItem | null; onClose: () => void }) {
	return (
		<Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>{item && <PriceForm key={item.id} item={item} onDone={onClose} />}</DialogContent>
		</Dialog>
	);
}

function PriceForm({ item, onDone }: { item: ServiceCatalogItem; onDone: () => void }) {
	const queryClient = useQueryClient();
	const [price, setPrice] = useState(String(item.clinicPrice ?? item.defaultPrice));
	const [hmoPrice, setHmoPrice] = useState(item.hmoPrice == null ? '' : String(item.hmoPrice));
	const onSuccess = async () => {
		await queryClient.invalidateQueries(clinicSetupApi.services.pathFilter());
		onDone();
	};
	const set = useMutation(clinicSetupApi.setClinicPrice.mutationOptions({ onSuccess }));
	const remove = useMutation(clinicSetupApi.removeClinicPrice.mutationOptions({ onSuccess }));
	const value = numberOrNull(price);
	const error = set.error ?? remove.error;

	return (
		<form
			className={styles.form}
			onSubmit={(event) => {
				event.preventDefault();
				if (value !== null) {
					set.mutate({ serviceItemId: item.id, price: value, hmoPrice: numberOrNull(hmoPrice) });
				}
			}}
		>
			<DialogHeader>
				<DialogTitle>Price at this clinic: {item.name}</DialogTitle>
				<DialogDescription>Default {peso(item.defaultPrice)} across the organization.</DialogDescription>
			</DialogHeader>
			<div className={styles.fields}>
				<Field label='Clinic price (₱)' required>
					{(id) => (
						<Input
							id={id}
							type='number'
							min={0}
							step='0.01'
							inputMode='decimal'
							value={price}
							onChange={(event) => setPrice(event.target.value)}
							required
						/>
					)}
				</Field>
				<Field label='HMO rate (₱)' hint='Contracted rate, when different.'>
					{(id, describedBy) => (
						<Input
							id={id}
							type='number'
							min={0}
							step='0.01'
							inputMode='decimal'
							aria-describedby={describedBy}
							value={hmoPrice}
							onChange={(event) => setHmoPrice(event.target.value)}
						/>
					)}
				</Field>
			</div>
			{error && <ErrorMessage message={error.message} />}
			<DialogFooter>
				{item.clinicPrice != null && (
					<Button
						type='button'
						variant='outline'
						size='sm'
						disabled={remove.isPending}
						onClick={() => remove.mutate({ serviceItemId: item.id })}
					>
						Use the default price
					</Button>
				)}
				<Button type='submit' size='sm' disabled={value === null || set.isPending}>
					Save price
				</Button>
			</DialogFooter>
		</form>
	);
}
