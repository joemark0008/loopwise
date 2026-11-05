import { describe, expect, it } from 'vitest';

import { assertEditableDraft, assertVoidable, issueDocument, newVerificationCode } from './document-lifecycle.js';
import { DocumentAlreadyIssuedError, DocumentVoidedError } from './documents.errors.js';

describe('document lifecycle', () => {
	const now = new Date('2026-11-05T02:00:00Z');

	it('issues a draft once, stamping the issue time', () => {
		expect(issueDocument({ documentStatus: 'DRAFT', voided: false }, 'prescription', 'RX-1', now)).toEqual({
			documentStatus: 'ISSUED',
			issuedAt: now,
		});
		expect(() => issueDocument({ documentStatus: 'ISSUED', voided: false }, 'prescription', 'RX-1')).toThrow(
			DocumentAlreadyIssuedError,
		);
		expect(() => issueDocument({ documentStatus: 'DRAFT', voided: true }, 'prescription', 'RX-1')).toThrow(
			DocumentVoidedError,
		);
	});

	it('edits only drafts and voids only once', () => {
		expect(() => assertEditableDraft({ documentStatus: 'DRAFT', voided: false }, 'x', 'n')).not.toThrow();
		expect(() => assertEditableDraft({ documentStatus: 'ISSUED', voided: false }, 'x', 'n')).toThrow(
			DocumentAlreadyIssuedError,
		);
		expect(() => assertVoidable({ documentStatus: 'ISSUED', voided: false }, 'x', 'n')).not.toThrow();
		expect(() => assertVoidable({ documentStatus: 'ISSUED', voided: true }, 'x', 'n')).toThrow(DocumentVoidedError);
	});

	it('makes verification codes without look-alike characters', () => {
		const code = newVerificationCode();
		expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
		expect(newVerificationCode()).not.toBe(code);
	});
});
