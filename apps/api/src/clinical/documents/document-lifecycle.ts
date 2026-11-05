import { randomBytes } from 'node:crypto';

import { registerEnumType } from '@nestjs/graphql';

import { DocumentStatus } from '../../generated/prisma/enums.js';
import { DocumentAlreadyIssuedError, DocumentVoidedError } from './documents.errors.js';

registerEnumType(DocumentStatus, {
	name: 'DocumentStatus',
	description: 'DRAFT (editable) or ISSUED (signed and locked; it can then only be voided).',
});

export { DocumentStatus };

/**
 * The lifecycle shared by prescriptions and medical certificates, the TypeScript mirror of the lock triggers of
 * migration 0001 (`prescriptions_lock`, `prescription_items_lock`, `medical_certificates_lock`):
 *
 * ```
 * DRAFT ──issue──► ISSUED          (signatory frozen, issuedAt set; locked)
 *   │                 │
 *   └──void──► voided ◄┘           (who, when, why; final)
 * ```
 *
 * A draft is edited freely; an issued document changes only by voiding (and, for prescriptions, dispensing); a voided
 * one never changes again and never returns to draft.
 */
export interface DocumentState {
	documentStatus: DocumentStatus;
	/** Whether the document is voided (Rx: `voidedAt` set; certificate: `isVoid`). */
	voided: boolean;
}

/** A draft may be edited; refused once issued or voided. */
export function assertEditableDraft(document: DocumentState, label: string, number: string): void {
	if (document.voided) {
		throw new DocumentVoidedError(label, number);
	}
	if (document.documentStatus !== 'DRAFT') {
		throw new DocumentAlreadyIssuedError(label, number);
	}
}

/** DRAFT → ISSUED: the columns the issue sets besides the signatory. */
export function issueDocument(
	document: DocumentState,
	label: string,
	number: string,
	now: Date = new Date(),
): { documentStatus: 'ISSUED'; issuedAt: Date } {
	assertEditableDraft(document, label, number);
	return { documentStatus: 'ISSUED', issuedAt: now };
}

/** Any document not voided yet may be voided (a draft written in error, or an issued one). */
export function assertVoidable(document: DocumentState, label: string, number: string): void {
	if (document.voided) {
		throw new DocumentVoidedError(label, number);
	}
}

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * The code printed (as text and QR) on a prescription or certificate, so a pharmacy or employer can check it is
 * genuine: 10 characters from an alphabet without look-alikes (0/O, 1/I), ~50 bits of randomness.
 */
export function newVerificationCode(length = 10): string {
	const bytes = randomBytes(length);
	return [...bytes].map((byte) => BASE32[byte % BASE32.length]).join('');
}
