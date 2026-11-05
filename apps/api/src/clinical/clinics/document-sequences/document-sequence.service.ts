import { Injectable } from '@nestjs/common';

import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { DocumentSequenceRepository } from './document-sequence.repository.js';

/**
 * The human-readable numbers of a clinic's documents (the reference's DocumentSequence key). The clinic's code is in
 * the prefix, so numbers are unique across the organization's clinics too.
 */
export const DOCUMENT_SEQUENCE_KEYS = {
	PATIENT: 'PT',
	ENCOUNTER: 'ENC',
	LAB_ORDER: 'LAB',
	RX: 'RX',
	MED_CERT: 'MC',
	INVOICE: 'SI',
	PAYMENT: 'PAY',
} as const;

export type DocumentSequenceKey = keyof typeof DOCUMENT_SEQUENCE_KEYS;

export const DEFAULT_PAD_LENGTH = 6;

/** The prefix a sequence starts with when the clinic hasn't set one: `TAG-RX-2026-`. */
export function defaultSequencePrefix(clinicCode: string, key: DocumentSequenceKey, year: number): string {
	return `${clinicCode}-${DOCUMENT_SEQUENCE_KEYS[key]}-${year}-`;
}

/** A number as the sequence prints it. */
export function formatSequenceNumber(prefix: string | null, value: number, padLength: number): string {
	return `${prefix ?? ''}${String(value).padStart(padLength, '0')}`;
}

/**
 * Issues per-clinic running numbers (MRN / patient no., encounter no., lab order no., Rx no., med cert no.,
 * invoice and payment no.). Every sequence restarts each calendar year (Asia/Manila) and the year is part of the
 * number, e.g. `TAG-RX-2026-000123`: unique for good, and readable at the front desk.
 */
@Injectable()
export class DocumentSequenceService {
	constructor(private readonly sequences: DocumentSequenceRepository) {}

	/**
	 * The next number of `key` at the clinic, on the caller's transaction: if the transaction rolls back, the number
	 * is not used up. `clinicCode` is the clinic's short code (`clinics.code`).
	 */
	async next(
		tx: ClinicalTx,
		clinic: { id: string; code: string },
		key: DocumentSequenceKey,
		now: Date = new Date(),
	): Promise<string> {
		const year = manilaYear(now);
		const issued = await this.sequences.takeNext(tx, {
			clinicId: clinic.id,
			key,
			year,
			prefix: defaultSequencePrefix(clinic.code, key, year),
			padLength: DEFAULT_PAD_LENGTH,
		});
		return formatSequenceNumber(issued.prefix, issued.value, issued.padLength);
	}
}

/** The calendar year in the Philippines (UTC+8, no daylight saving). */
export function manilaYear(date: Date): number {
	return new Date(date.getTime() + 8 * 60 * 60 * 1000).getUTCFullYear();
}
