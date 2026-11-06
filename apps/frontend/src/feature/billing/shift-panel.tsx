import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CASH_DENOMINATIONS, countedCash, formatPesos, PAYMENT_METHOD_LABELS } from '@loopwise/shared/invoice';
import { useState } from 'react';
import styles from './billing.module.css';
import type { CashierShiftFieldsFragment } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
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
import { formatDateTime } from '@/feature/encounters/encounter-format';
import { FormField } from '@/feature/encounters/form-field';
import { billingApi } from '@/lib/billing-api';

/** "₱1,000" or "25¢": how a bill or coin is labelled at the count. */
const denominationLabel = (value: number) => (value >= 1 ? `₱${value.toLocaleString('en-PH')}` : `${value * 100}¢`);

/**
 * The cashier's shift on the desk: open it with the cash float; while open, the running totals by method and the X
 * reading (a printed-style summary, the shift stays open); the Z reading counts the cash by bill and coin and closes
 * it, showing the expected cash and the variance.
 */
export function ShiftPanel({ shift }: { shift: CashierShiftFieldsFragment | null }) {
	return shift ? <OpenShift shift={shift} /> : <OpenShiftForm />;
}

function OpenShiftForm() {
	const queryClient = useQueryClient();
	const [openingCash, setOpeningCash] = useState('');
	const open = useMutation(
		billingApi.billing.openShift.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries(billingApi.invalidate),
		}),
	);
	const amount = Number(openingCash);
	const invalid = openingCash.trim() === '' || !Number.isFinite(amount) || amount < 0;
	return (
		<section className={styles.panel} aria-labelledby='shift-title' data-testid='shift-panel'>
			<div className={styles.panelHeader}>
				<h2 id='shift-title' className={styles.panelTitle}>
					Your shift
				</h2>
				<span className={styles.muted}>Closed</span>
			</div>
			<p className={styles.muted}>Open a shift with the cash float in your drawer before taking payments.</p>
			<form
				className={styles.toolbar}
				onSubmit={(event) => {
					event.preventDefault();
					if (!invalid) {
						open.mutate({ openingCash: Math.round(amount * 100) / 100 });
					}
				}}
			>
				<FormField label='Opening cash' unit='₱'>
					{(id) => (
						<Input
							id={id}
							inputMode='decimal'
							value={openingCash}
							onChange={(event) => setOpeningCash(event.target.value)}
							disabled={open.isPending}
						/>
					)}
				</FormField>
				<Button type='submit' disabled={invalid || open.isPending}>
					Open shift
				</Button>
			</form>
			{open.error && <ErrorMessage message={open.error.message} />}
		</section>
	);
}

function OpenShift({ shift }: { shift: CashierShiftFieldsFragment }) {
	const queryClient = useQueryClient();
	const [reading, setReading] = useState<CashierShiftFieldsFragment | null>(null);
	const [closing, setClosing] = useState(false);
	const xReading = useMutation(
		billingApi.billing.xReading.mutationOptions({
			onSuccess: (result) => {
				setReading(result);
				void queryClient.invalidateQueries(billingApi.invalidate);
			},
		}),
	);
	return (
		<section className={styles.panel} aria-labelledby='shift-title' data-testid='shift-panel'>
			<div className={styles.panelHeader}>
				<h2 id='shift-title' className={styles.panelTitle}>
					Your shift
				</h2>
				<span className={styles.muted}>Open since {formatDateTime(shift.openedAt)}</span>
			</div>
			<ShiftFigures shift={reading ?? shift} />
			<div className={styles.actions}>
				<Button
					variant='outline'
					disabled={xReading.isPending}
					onClick={() => xReading.mutate({ shiftId: shift.id })}
				>
					X reading
				</Button>
				<Button onClick={() => setClosing(true)}>Close shift (Z reading)</Button>
			</div>
			{reading && (
				<p className={styles.muted} role='status' data-testid='x-reading'>
					X reading taken: {formatPesos(reading.totalCollected)} collected,{' '}
					{formatPesos(reading.expectedCash)} expected in the drawer.
				</p>
			)}
			{xReading.error && <ErrorMessage message={xReading.error.message} />}
			<ZReadingDialog shift={shift} open={closing} onOpenChange={setClosing} />
		</section>
	);
}

/** A shift's totals by method, cash expected in the drawer and, once closed, the count and the variance. */
export function ShiftFigures({ shift }: { shift: CashierShiftFieldsFragment }) {
	return (
		<div className={styles.tableScroll}>
			<table className={styles.table} data-testid='shift-figures'>
				<tbody>
					<tr>
						<td>Opening cash</td>
						<td data-numeric>{formatPesos(shift.openingCash)}</td>
					</tr>
					{shift.byMethod.map((total) => (
						<tr key={total.method}>
							<td>
								{PAYMENT_METHOD_LABELS[total.method]} ({total.count})
							</td>
							<td data-numeric>{formatPesos(total.amount)}</td>
						</tr>
					))}
					{shift.voidedCount > 0 && (
						<tr>
							<td>Voided ({shift.voidedCount})</td>
							<td data-numeric>{formatPesos(shift.voidedAmount)}</td>
						</tr>
					)}
					<tr>
						<td>Total collected</td>
						<td data-numeric>{formatPesos(shift.totalCollected)}</td>
					</tr>
					<tr>
						<td>
							<strong>Expected cash</strong>
						</td>
						<td data-numeric>
							<strong>{formatPesos(shift.expectedCash)}</strong>
						</td>
					</tr>
					{shift.countedCash !== null && (
						<tr>
							<td>Counted cash</td>
							<td data-numeric>{formatPesos(shift.countedCash)}</td>
						</tr>
					)}
					{shift.variance !== null && (
						<tr>
							<td>Variance</td>
							<td data-numeric className={styles.variance} data-short={shift.variance < 0 || undefined}>
								{formatPesos(shift.variance)}
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}

/** The Z reading: count the drawer by bill and coin; the variance shows before closing. */
function ZReadingDialog({
	shift,
	open,
	onOpenChange,
}: {
	shift: CashierShiftFieldsFragment;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [counts, setCounts] = useState<Record<string, string>>({});
	const [remarks, setRemarks] = useState('');
	const [closed, setClosed] = useState<CashierShiftFieldsFragment | null>(null);
	const close = useMutation(
		// The desk reads again on "Done": the closed shift's reading stays in view until then.
		billingApi.billing.closeShift.mutationOptions({ onSuccess: setClosed }),
	);
	const numbers = Object.fromEntries(
		Object.entries(counts).map(([denomination, count]) => [
			denomination,
			Math.max(0, Math.trunc(Number(count) || 0)),
		]),
	);
	const counted = countedCash(numbers);
	const variance = Math.round((counted - shift.expectedCash) * 100) / 100;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next && closed) {
					void queryClient.invalidateQueries(billingApi.invalidate);
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{closed ? 'Shift closed' : 'Close shift (Z reading)'}</DialogTitle>
					<DialogDescription>
						{closed
							? 'The Z reading is saved with the count.'
							: 'Count the drawer by bill and coin. The shift closes; payments need a new shift.'}
					</DialogDescription>
				</DialogHeader>
				{closed ? (
					<div data-testid='z-reading'>
						<ShiftFigures shift={closed} />
					</div>
				) : (
					<form
						id='z-reading-form'
						className={styles.paymentForm}
						onSubmit={(event) => {
							event.preventDefault();
							close.mutate({
								shiftId: shift.id,
								denominations: CASH_DENOMINATIONS.filter((value) => numbers[String(value)] > 0).map(
									(value) => ({ denomination: value, count: numbers[String(value)] }),
								),
								remarks: remarks.trim() || null,
							});
						}}
					>
						<div className={styles.denominations}>
							{CASH_DENOMINATIONS.map((value) => (
								<FormField key={value} label={denominationLabel(value)}>
									{(id) => (
										<Input
											id={id}
											inputMode='numeric'
											value={counts[String(value)] ?? ''}
											onChange={(event) =>
												setCounts({ ...counts, [String(value)]: event.target.value })
											}
											disabled={close.isPending}
										/>
									)}
								</FormField>
							))}
						</div>
						<p className={styles.muted} data-testid='z-reading-preview'>
							Counted {formatPesos(counted)} · expected {formatPesos(shift.expectedCash)} · variance{' '}
							<span className={styles.variance} data-short={variance < 0 || undefined}>
								{formatPesos(variance)}
							</span>
						</p>
						{variance !== 0 && (
							<FormField label='Why the count differs'>
								{(id) => (
									<Input
										id={id}
										value={remarks}
										onChange={(event) => setRemarks(event.target.value)}
										disabled={close.isPending}
									/>
								)}
							</FormField>
						)}
						{close.error && <ErrorMessage message={close.error.message} />}
					</form>
				)}
				<DialogFooter>
					{closed ? (
						<Button
							onClick={() => {
								onOpenChange(false);
								void queryClient.invalidateQueries(billingApi.invalidate);
							}}
						>
							Done
						</Button>
					) : (
						<>
							<Button variant='outline' onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button type='submit' form='z-reading-form' disabled={close.isPending}>
								Close shift
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
