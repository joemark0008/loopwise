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

const PAD_LENGTH = 6;

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
			prefix: `${clinic.code}-${DOCUMENT_SEQUENCE_KEYS[key]}-${year}-`,
			padLength: PAD_LENGTH,
		});
		return `${issued.prefix ?? ''}${String(issued.value).padStart(issued.padLength, '0')}`;
	}
}

/** The calendar year in the Philippines (UTC+8, no daylight saving). */
export function manilaYear(date: Date): number {
	return new Date(date.getTime() + 8 * 60 * 60 * 1000).getUTCFullYear();
}
