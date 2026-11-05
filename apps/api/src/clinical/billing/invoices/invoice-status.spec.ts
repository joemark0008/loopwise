import { describe, expect, it } from 'vitest';

import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import { InvoiceAlreadyIssuedError, InvoiceVoidedError } from '../billing.errors.js';
import { assertInvoiceEditable, assertInvoiceTransition, canTransitionInvoice } from './invoice-status.js';

describe('invoice status machine', () => {
	it.each([
		['DRAFT', 'ISSUED'],
		['DRAFT', 'VOID'],
		['ISSUED', 'PARTIALLY_PAID'],
		['ISSUED', 'PAID'],
		['PARTIALLY_PAID', 'PARTIALLY_PAID'],
		['PARTIALLY_PAID', 'PAID'],
		['PAID', 'VOID'],
	] as const)('allows %s → %s', (from, to) => {
		expect(canTransitionInvoice(from, to)).toBe(true);
	});

	it.each([
		['DRAFT', 'PAID'],
		['ISSUED', 'DRAFT'],
		['PAID', 'PARTIALLY_PAID'],
		['PAID', 'ISSUED'],
		['VOID', 'DRAFT'],
		['VOID', 'ISSUED'],
	] as const)('refuses %s → %s', (from, to) => {
		expect(canTransitionInvoice(from, to)).toBe(false);
	});

	it('says why: already issued, void, or not allowed', () => {
		expect(() => assertInvoiceTransition({ status: 'PAID', invoiceNo: 'SI-1' }, 'ISSUED')).toThrow(
			InvoiceAlreadyIssuedError,
		);
		expect(() => assertInvoiceTransition({ status: 'VOID', invoiceNo: 'SI-1' }, 'VOID')).toThrow(
			InvoiceVoidedError,
		);
		expect(() => assertInvoiceTransition({ status: 'DRAFT', invoiceNo: null }, 'PAID')).toThrow(
			InvalidStatusTransitionError,
		);
		expect(() => assertInvoiceTransition({ status: 'ISSUED', invoiceNo: 'SI-1' }, 'PAID')).not.toThrow();
	});

	it('edits drafts only', () => {
		expect(() => assertInvoiceEditable({ status: 'DRAFT', invoiceNo: null })).not.toThrow();
		expect(() => assertInvoiceEditable({ status: 'ISSUED', invoiceNo: 'SI-1' })).toThrow(/already issued/);
		expect(() => assertInvoiceEditable({ status: 'VOID', invoiceNo: null })).toThrow(InvoiceVoidedError);
	});
});
