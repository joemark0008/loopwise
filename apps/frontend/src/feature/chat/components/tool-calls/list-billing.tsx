import { formatPesos, INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@loopwise/shared/invoice';
import { Wallet } from 'lucide-react';
import { memo } from 'react';
import styles from './propose-action.module.css';
import type { InvoiceStatus, PaymentMethod } from '@loopwise/shared/invoice';
import type { listBilling } from '@loopwise/shared/tools';
import type { ToolCallComponentProps } from '.';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';

const methodLabel = (method: string) => PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
const statusLabel = (status: string) => INVOICE_STATUS_LABELS[status as InvoiceStatus] ?? status;

/** `list_billing`: the cashier desk read for Wise — collections by method, open invoices, or the user's shift. */
export const ListBillingToolCall = memo(({ toolPart }: ToolCallComponentProps<'list_billing'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	const output = toolPart.output as listBilling.Output | undefined;
	if (!output) {
		return null;
	}
	if (output.view === 'collections') {
		const collections = output.collections ?? [];
		return (
			<div className={styles.resultsCard} data-testid='billing-collections'>
				<p className={styles.resultsTitle}>
					<Wallet aria-hidden /> Collections · {output.date} · {formatPesos(output.totalCollected ?? 0)}
				</p>
				{collections.length === 0 ? (
					<p className={styles.meta}>No payments.</p>
				) : (
					<ul className={styles.list}>
						{collections.map((total) => (
							<li key={total.method}>
								<strong>{methodLabel(total.method)}</strong> · {total.count} ·{' '}
								{formatPesos(total.amount)}
							</li>
						))}
					</ul>
				)}
			</div>
		);
	}
	if (output.view === 'shift') {
		const shift = output.shift;
		return (
			<div className={styles.resultsCard} data-testid='billing-shift'>
				<p className={styles.resultsTitle}>
					<Wallet aria-hidden /> Cashier shift
				</p>
				{!shift ? (
					<p className={styles.meta}>No open shift.</p>
				) : (
					<>
						<p className={styles.meta}>
							Opened {new Date(shift.openedAt).toLocaleTimeString('en-PH', { timeStyle: 'short' })} ·
							float {formatPesos(shift.openingCash)} · {shift.paymentCount} payments · expected cash{' '}
							{formatPesos(shift.expectedCash)}
						</p>
						<ul className={styles.list}>
							{shift.byMethod.map((total) => (
								<li key={total.method}>
									<strong>{methodLabel(total.method)}</strong> · {total.count} ·{' '}
									{formatPesos(total.amount)}
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		);
	}
	const invoices = output.openInvoices ?? [];
	return (
		<div className={styles.resultsCard} data-testid='billing-open-invoices'>
			<p className={styles.resultsTitle}>
				<Wallet aria-hidden /> Open invoices ({invoices.length})
			</p>
			{invoices.length === 0 ? (
				<p className={styles.meta}>Nothing to settle.</p>
			) : (
				<ul className={styles.list}>
					{invoices.map((invoice, index) => (
						<li key={`${invoice.invoiceNo ?? 'draft'}-${index}`}>
							<strong>{invoice.invoiceNo ?? 'Draft'}</strong> · {invoice.buyerName} ·{' '}
							{statusLabel(invoice.status)} · balance {formatPesos(invoice.balance)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
});
