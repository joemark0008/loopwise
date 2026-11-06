import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './pharmacy.module.css';
import { CATEGORY_LABELS, numberOrNull, orNull, TAX_LABELS } from './pharmacy-format';
import type { ItemCategory, TaxType } from '@/graphql/generated/graphql';
import type { InventoryItem } from '@/lib/pharmacy-api';
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
import { Field } from '@/feature/settings/clinic-setup/setup-form';
import { pharmacyApi } from '@/lib/pharmacy-api';

const NONE = '__none__';

type Values = {
	sku: string;
	barcode: string;
	name: string;
	category: ItemCategory;
	genericName: string;
	brandName: string;
	strength: string;
	dosageForm: string;
	manufacturer: string;
	fdaCprNo: string;
	isRxOnly: boolean;
	isDangerousDrug: boolean;
	isAntimicrobial: boolean;
	isPnf: boolean;
	storageCondition: string;
	unitOfMeasure: string;
	packSize: string;
	taxType: TaxType;
	defaultCost: string;
	sellingPrice: string;
	reorderLevel: string;
	isActive: boolean;
	serviceItemId: string;
};

const text = (value: string | null | undefined) => value ?? '';
const num = (value: number | null | undefined) => (value == null ? '' : String(value));

/** Adds or edits an item of the inventory master, and links it to the service that sells it. */
export function ItemDialog({ item, onClose }: { item: InventoryItem | 'new' | null; onClose: () => void }) {
	return (
		<Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				{item && <ItemForm key={item === 'new' ? 'new' : item.id} item={item} onDone={onClose} />}
			</DialogContent>
		</Dialog>
	);
}

function ItemForm({ item, onDone }: { item: InventoryItem | 'new'; onDone: () => void }) {
	const queryClient = useQueryClient();
	const existing = item === 'new' ? null : item;
	const [values, setValues] = useState<Values>(() => ({
		sku: text(existing?.sku),
		barcode: text(existing?.barcode),
		name: text(existing?.name),
		category: existing?.category ?? 'MEDICINE',
		genericName: text(existing?.genericName),
		brandName: text(existing?.brandName),
		strength: text(existing?.strength),
		dosageForm: text(existing?.dosageForm),
		manufacturer: text(existing?.manufacturer),
		fdaCprNo: text(existing?.fdaCprNo),
		isRxOnly: existing?.isRxOnly ?? true,
		isDangerousDrug: existing?.isDangerousDrug ?? false,
		isAntimicrobial: existing?.isAntimicrobial ?? false,
		isPnf: existing?.isPnf ?? false,
		storageCondition: text(existing?.storageCondition),
		unitOfMeasure: text(existing?.unitOfMeasure),
		packSize: num(existing?.packSize),
		taxType: existing?.taxType ?? 'VATABLE',
		defaultCost: num(existing?.defaultCost),
		sellingPrice: num(existing?.sellingPrice),
		reorderLevel: num(existing?.reorderLevel),
		isActive: existing?.isActive ?? true,
		serviceItemId: existing?.serviceItem?.id ?? '',
	}));
	const services = useQuery(pharmacyApi.serviceOptions.queryOptions({}));
	const link = useMutation(pharmacyApi.setServiceLink.mutationOptions());
	const save = useMutation(
		pharmacyApi.saveItem.mutationOptions({
			onSuccess: async (saved) => {
				if ((saved.serviceItem?.id ?? '') !== values.serviceItemId) {
					await link.mutateAsync({ itemId: saved.id, serviceItemId: values.serviceItemId || null });
				}
				await queryClient.invalidateQueries(pharmacyApi.all.pathFilter());
				onDone();
			},
		}),
	);
	const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues({ ...values, [key]: value });
	const isDrug = values.category === 'MEDICINE' || values.category === 'VACCINE';
	const valid =
		values.sku.trim() &&
		values.name.trim() &&
		values.unitOfMeasure.trim() &&
		(!isDrug || values.genericName.trim());
	const linkable = (services.data ?? []).filter(
		(service) => !service.linkedItemId || service.linkedItemId === existing?.id,
	);
	const textField = (key: keyof Values, label: string, options: { required?: boolean; hint?: string } = {}) => (
		<Field label={label} required={options.required} hint={options.hint}>
			{(id, describedBy) => (
				<Input
					id={id}
					aria-describedby={describedBy}
					value={values[key] as string}
					onChange={(event) =>
						set(key, (key === 'sku' ? event.target.value.toUpperCase() : event.target.value) as never)
					}
					required={options.required}
				/>
			)}
		</Field>
	);
	const numberField = (key: keyof Values, label: string, hint?: string) => (
		<Field label={label} hint={hint}>
			{(id, describedBy) => (
				<Input
					id={id}
					aria-describedby={describedBy}
					type='number'
					min={0}
					step='0.01'
					inputMode='decimal'
					value={values[key] as string}
					onChange={(event) => set(key, event.target.value as never)}
				/>
			)}
		</Field>
	);
	const check = (key: keyof Values, label: string) => (
		<label className={styles.checkboxRow}>
			<Checkbox checked={values[key] as boolean} onCheckedChange={(checked) => set(key, checked as never)} />
			{label}
		</label>
	);

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
					sku: values.sku.trim().toUpperCase(),
					barcode: orNull(values.barcode),
					name: values.name.trim(),
					category: values.category,
					genericName: orNull(values.genericName),
					brandName: orNull(values.brandName),
					strength: orNull(values.strength),
					dosageForm: orNull(values.dosageForm),
					manufacturer: orNull(values.manufacturer),
					fdaCprNo: orNull(values.fdaCprNo),
					isRxOnly: values.isRxOnly,
					isDangerousDrug: values.isDangerousDrug,
					isAntimicrobial: values.isAntimicrobial,
					isPnf: values.isPnf,
					storageCondition: orNull(values.storageCondition),
					unitOfMeasure: values.unitOfMeasure.trim(),
					packSize: numberOrNull(values.packSize),
					taxType: values.taxType,
					defaultCost: numberOrNull(values.defaultCost),
					sellingPrice: numberOrNull(values.sellingPrice),
					reorderLevel: numberOrNull(values.reorderLevel),
					isActive: values.isActive,
				});
			}}
		>
			<DialogHeader>
				<DialogTitle>{existing ? `Edit ${existing.displayName}` : 'Add an item'}</DialogTitle>
				<DialogDescription>Part of the organization's inventory master, at every clinic.</DialogDescription>
			</DialogHeader>
			<div className={styles.fields}>
				{textField('sku', 'SKU', { required: true, hint: "Capital letters, digits and '-'." })}
				{textField('barcode', 'Barcode')}
				{textField('name', 'Name', { required: true, hint: 'Generic first: "Amoxicillin 500 mg capsule".' })}
				<Field label='Category'>
					{(id) => (
						<Select
							value={values.category}
							onValueChange={(value) => set('category', value as ItemCategory)}
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
				{textField('genericName', 'Generic name', { required: isDrug })}
				{textField('brandName', 'Brand name')}
				{textField('strength', 'Strength', { hint: 'e.g. 500 mg' })}
				{textField('dosageForm', 'Dosage form', { hint: 'tablet, capsule, suspension …' })}
				{textField('manufacturer', 'Manufacturer')}
				{textField('fdaCprNo', 'FDA CPR no.')}
				{textField('storageCondition', 'Storage', { hint: 'e.g. 2–8°C' })}
				{textField('unitOfMeasure', 'Unit', { required: true, hint: 'tab, cap, vial, pc …' })}
				{numberField('packSize', 'Pack size', 'Units per box')}
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
				{numberField('defaultCost', 'Cost (₱ per unit)')}
				{numberField('sellingPrice', 'Selling price (₱)', 'Used when no service sells it')}
				{numberField('reorderLevel', 'Reorder level', 'Alert at or below')}
				<Field label='Sold as service' hint='Settings → Services owns the price.'>
					{(id, describedBy) => (
						<Select
							value={values.serviceItemId || NONE}
							onValueChange={(value) => set('serviceItemId', value === NONE ? '' : value)}
						>
							<SelectTrigger id={id} aria-label='Sold as service' aria-describedby={describedBy}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>None</SelectItem>
								{linkable.map((service) => (
									<SelectItem key={service.id} value={service.id}>
										{service.code} · {service.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>
			</div>
			<div className={styles.checks}>
				{check('isRxOnly', 'Prescription only')}
				{check('isDangerousDrug', 'Dangerous drug (RA 9165, S2)')}
				{check('isAntimicrobial', 'Antimicrobial')}
				{check('isPnf', 'In the PNF')}
				{check('isActive', 'Active')}
			</div>
			{(save.error ?? link.error) && <ErrorMessage message={(save.error ?? link.error)?.message ?? ''} />}
			<DialogFooter>
				<Button type='button' variant='outline' size='sm' onClick={onDone}>
					Cancel
				</Button>
				<Button type='submit' size='sm' disabled={!valid || save.isPending}>
					{existing ? 'Save item' : 'Add item'}
				</Button>
			</DialogFooter>
		</form>
	);
}
