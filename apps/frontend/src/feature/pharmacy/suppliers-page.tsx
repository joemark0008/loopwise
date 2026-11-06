import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { useState } from 'react';
import { usePharmacyAccess } from './pharmacy-layout';
import styles from './pharmacy.module.css';
import { orNull } from './pharmacy-format';
import type { Supplier } from '@/lib/pharmacy-api';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Field } from '@/feature/settings/clinic-setup/setup-form';
import { pharmacyApi } from '@/lib/pharmacy-api';

/** Pharmacy → Suppliers: the organization's suppliers with their FDA License to Operate. */
export function SuppliersPage() {
	const { canManageStock } = usePharmacyAccess();
	const [includeInactive, setIncludeInactive] = useState(false);
	const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
	const suppliers = useQuery(pharmacyApi.suppliers.queryOptions({ includeInactive }));
	return (
		<PageSection title='Suppliers' meta={suppliers.data ? String(suppliers.data.length) : undefined}>
			<div className={styles.toolbar}>
				<label className={styles.checkboxRow}>
					<Checkbox checked={includeInactive} onCheckedChange={setIncludeInactive} />
					Show inactive
				</label>
				{canManageStock && (
					<Button size='sm' onClick={() => setEditing('new')}>
						Add supplier
					</Button>
				)}
			</div>
			{suppliers.isPending ? (
				<Skeleton />
			) : suppliers.error ? (
				<ErrorMessage message={suppliers.error.message} />
			) : suppliers.data.length === 0 ? (
				<EmptyState icon={Truck} title='No suppliers yet'>
					Add the distributors the clinic buys from.
				</EmptyState>
			) : (
				<div className={pageStyles.tableScroll}>
					<table className={pageStyles.table} data-reflow data-testid='suppliers'>
						<caption className='sr-only'>Suppliers</caption>
						<thead>
							<tr>
								<th scope='col'>Supplier</th>
								<th scope='col'>FDA LTO</th>
								<th scope='col'>TIN</th>
								<th scope='col'>Contact</th>
								<th scope='col'>
									<span className='sr-only'>Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{suppliers.data.map((supplier) => (
								<tr key={supplier.id}>
									<td data-label='Supplier'>
										<div className={styles.main}>{supplier.name}</div>
										<div className={styles.muted}>
											{supplier.address ?? ''}
											{!supplier.isActive && ' (inactive)'}
										</div>
									</td>
									<td data-label='FDA LTO' className={styles.code}>
										{supplier.fdaLtoNo ?? '—'}
									</td>
									<td data-label='TIN'>{supplier.tin ?? '—'}</td>
									<td data-label='Contact'>
										{supplier.contactPerson ?? '—'}
										<div className={styles.muted}>
											{[supplier.contactNo, supplier.email].filter(Boolean).join(' · ')}
										</div>
									</td>
									<td data-label='Actions'>
										{canManageStock && (
											<Button
												variant='ghost'
												size='sm'
												aria-label={`Edit ${supplier.name}`}
												onClick={() => setEditing(supplier)}
											>
												Edit
											</Button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
				<DialogContent>
					{editing && (
						<SupplierForm
							key={editing === 'new' ? 'new' : editing.id}
							supplier={editing}
							onDone={() => setEditing(null)}
						/>
					)}
				</DialogContent>
			</Dialog>
		</PageSection>
	);
}

type Values = Record<'name' | 'tin' | 'address' | 'contactPerson' | 'contactNo' | 'email' | 'fdaLtoNo', string>;

function SupplierForm({ supplier, onDone }: { supplier: Supplier | 'new'; onDone: () => void }) {
	const queryClient = useQueryClient();
	const existing = supplier === 'new' ? null : supplier;
	const [values, setValues] = useState<Values>(() => ({
		name: existing?.name ?? '',
		tin: existing?.tin ?? '',
		address: existing?.address ?? '',
		contactPerson: existing?.contactPerson ?? '',
		contactNo: existing?.contactNo ?? '',
		email: existing?.email ?? '',
		fdaLtoNo: existing?.fdaLtoNo ?? '',
	}));
	const [isActive, setIsActive] = useState(existing?.isActive ?? true);
	const save = useMutation(
		pharmacyApi.saveSupplier.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries(pharmacyApi.suppliers.pathFilter());
				onDone();
			},
		}),
	);
	const field = (key: keyof Values, label: string, required = false) => (
		<Field label={label} required={required}>
			{(id) => (
				<Input
					id={id}
					value={values[key]}
					onChange={(event) => setValues({ ...values, [key]: event.target.value })}
					required={required}
				/>
			)}
		</Field>
	);
	return (
		<form
			className={styles.form}
			onSubmit={(event) => {
				event.preventDefault();
				if (!values.name.trim()) {
					return;
				}
				save.mutate({
					id: existing?.id ?? null,
					name: values.name.trim(),
					tin: orNull(values.tin),
					address: orNull(values.address),
					contactPerson: orNull(values.contactPerson),
					contactNo: orNull(values.contactNo),
					email: orNull(values.email),
					fdaLtoNo: orNull(values.fdaLtoNo),
					isActive,
				});
			}}
		>
			<DialogHeader>
				<DialogTitle>{existing ? `Edit ${existing.name}` : 'Add a supplier'}</DialogTitle>
				<DialogDescription>Shared by the organization's clinics.</DialogDescription>
			</DialogHeader>
			<div className={styles.fields}>
				{field('name', 'Name', true)}
				{field('fdaLtoNo', 'FDA LTO no.')}
				{field('tin', 'TIN')}
				{field('address', 'Address')}
				{field('contactPerson', 'Contact person')}
				{field('contactNo', 'Contact no.')}
				{field('email', 'Email')}
			</div>
			<label className={styles.checkboxRow}>
				<Checkbox checked={isActive} onCheckedChange={setIsActive} />
				Active
			</label>
			{save.error && <ErrorMessage message={save.error.message} />}
			<DialogFooter>
				<Button type='button' variant='outline' size='sm' onClick={onDone}>
					Cancel
				</Button>
				<Button type='submit' size='sm' disabled={!values.name.trim() || save.isPending}>
					{existing ? 'Save supplier' : 'Add supplier'}
				</Button>
			</DialogFooter>
		</form>
	);
}
