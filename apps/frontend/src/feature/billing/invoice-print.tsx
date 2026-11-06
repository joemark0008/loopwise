import { useQuery } from '@tanstack/react-query';
import { DISCOUNT_LABELS, formatPesos, PAYMENT_METHOD_LABELS } from '@loopwise/shared/invoice';
import printStyles from './invoice-print.module.css';
import type { StatutoryDiscountType } from '@loopwise/shared/invoice';
import { formatDay } from '@/feature/encounters/encounter-format';
import { PrintShell } from '@/feature/encounters/print/print-shell';
import styles from '@/feature/encounters/print/print.module.css';
import { billingApi } from '@/lib/billing-api';

/**
 * The printed BIR sales invoice (EOPT Act, RA 11976): the seller's registered name, trade name, TIN with the branch
 * code, VAT / non-VAT status and address; "SALES INVOICE" with its number and date; the buyer; the lines; the VAT
 * breakdown (VATable, VAT-exempt, zero-rated sales, VAT, less VAT and the SC/PWD discount, withholding, the amount
 * due); the SC/PWD beneficiary's name and ID; and the ATP / CAS permit of the series. Browser print.
 */
export function InvoicePrint({ invoiceId }: { invoiceId: string }) {
	const printable = useQuery(billingApi.billing.print.queryOptions({ id: invoiceId }));
	const data = printable.data;
	const invoice = data?.invoice;
	const statutory = invoice?.discounts.find((row) => row.type === 'SENIOR_CITIZEN' || row.type === 'PWD');
	const row = (label: string, value: number, strong = false) => (
		<tr key={label}>
			<td>{strong ? <strong>{label}</strong> : label}</td>
			<td className={printStyles.amount}>
				{strong ? <strong>{formatPesos(value)}</strong> : formatPesos(value)}
			</td>
		</tr>
	);

	return (
		<PrintShell
			title={invoice?.invoiceNo ? `Sales invoice ${invoice.invoiceNo}` : 'Sales invoice'}
			state={{ isPending: printable.isPending, error: printable.error, isMissing: !data }}
			watermark={invoice?.status === 'VOID' ? 'Void' : null}
		>
			{data && invoice && (
				<>
					<header className={styles.letterhead}>
						<span className={styles.facility}>{data.seller.registeredName}</span>
						{data.seller.tradeName && <span>{data.seller.tradeName}</span>}
						<span className={styles.small}>
							{data.seller.clinicName}
							{data.seller.address ? ` · ${data.seller.address}` : ''}
						</span>
						<span className={styles.small}>
							{data.seller.vatRegistered ? 'VAT Reg.' : 'Non-VAT Reg.'} TIN {data.seller.tin ?? '—'}
							{data.seller.birBranchCode ? `-${data.seller.birBranchCode}` : ''}
						</span>
					</header>
					<div className={printStyles.titleRow}>
						<span className={styles.title}>SALES INVOICE</span>
						<span>
							No. <strong data-testid='printed-invoice-no'>{invoice.invoiceNo}</strong>
						</span>
					</div>
					<dl className={styles.patientGrid}>
						<dt>Sold to</dt>
						<dd>{invoice.buyerName}</dd>
						<dt>Date</dt>
						<dd>{formatDay((invoice.issuedAt ?? invoice.invoiceDate).slice(0, 10))}</dd>
						<dt>TIN</dt>
						<dd>{data.buyerTin ?? ''}</dd>
						<dt>Address</dt>
						<dd>{data.buyerAddress ?? ''}</dd>
					</dl>
					<table className={printStyles.lines}>
						<thead>
							<tr>
								<th>Description</th>
								<th className={printStyles.amount}>Qty</th>
								<th className={printStyles.amount}>Unit price</th>
								<th className={printStyles.amount}>Amount</th>
							</tr>
						</thead>
						<tbody>
							{invoice.lines.map((line) => (
								<tr key={line.id}>
									<td>
										{line.description}
										{line.taxType === 'VATABLE'
											? ' (V)'
											: line.taxType === 'ZERO_RATED'
												? ' (Z)'
												: ''}
									</td>
									<td className={printStyles.amount}>{line.quantity}</td>
									<td className={printStyles.amount}>{formatPesos(line.unitPrice)}</td>
									<td className={printStyles.amount}>
										{formatPesos(line.quantity * line.unitPrice)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					<table className={printStyles.totals} data-testid='printed-totals'>
						<tbody>
							{row('Total sales', invoice.grossAmount)}
							{row('VATable sales', invoice.vatableSales)}
							{row('VAT-exempt sales', invoice.vatExemptSales)}
							{row('Zero-rated sales', invoice.zeroRatedSales)}
							{row('VAT amount (12%)', invoice.vatAmount)}
							{invoice.lessVatScPwd > 0 && row('Less: VAT (SC/PWD)', -invoice.lessVatScPwd)}
							{invoice.scPwdDiscount > 0 && row('Less: SC/PWD discount', -invoice.scPwdDiscount)}
							{invoice.otherDiscount > 0 && row('Less: other discount', -invoice.otherDiscount)}
							{invoice.withholdingTax > 0 && row('Less: withholding tax', -invoice.withholdingTax)}
							{row('Total amount due', invoice.netAmount, true)}
						</tbody>
					</table>
					{statutory && (
						<p className={printStyles.scPwd} data-testid='printed-sc-pwd'>
							{DISCOUNT_LABELS[statutory.type as StatutoryDiscountType]} · Name:{' '}
							<strong>{statutory.beneficiaryName}</strong> · {statutory.type === 'PWD' ? 'PWD' : 'OSCA'}{' '}
							ID No.: <strong>{statutory.idNumber}</strong> · Signature: ____________________
						</p>
					)}
					{invoice.payments.filter((payment) => payment.status === 'POSTED').length > 0 && (
						<p className={styles.small}>
							Paid:{' '}
							{invoice.payments
								.filter((payment) => payment.status === 'POSTED')
								.map(
									(payment) =>
										`${PAYMENT_METHOD_LABELS[payment.method]} ${formatPesos(payment.amount)}${payment.referenceNo ? ` (${payment.referenceNo})` : ''}`,
								)
								.join(', ')}
						</p>
					)}
					<div className={styles.footer}>
						<span>
							{data.permit
								? `${data.permit.permitNo ?? 'ATP / CAS'}${data.permit.permitDate ? ` · issued ${data.permit.permitDate}` : ''} · Series ${data.permit.range}${data.permit.validUntil ? ` · valid until ${data.permit.validUntil}` : ''}`
								: 'No BIR series registered for this number'}
						</span>
						<span>Synthetic demo data · Loopwise</span>
					</div>
				</>
			)}
		</PrintShell>
	);
}
