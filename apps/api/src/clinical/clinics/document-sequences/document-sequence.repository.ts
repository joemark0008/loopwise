import { Injectable } from '@nestjs/common';

import type { DocumentSequence } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

/** The one numbered value a sequence handed out, and how to format it. */
export interface IssuedSequenceValue {
	value: number;
	prefix: string | null;
	padLength: number;
}

/** `document_sequences`: per-clinic running numbers. Runs inside the caller's (RLS) transaction. */
@Injectable()
export class DocumentSequenceRepository {
	/**
	 * Takes the next value of the clinic's `key` sequence for `year`, creating the sequence on first use. One atomic
	 * statement (insert or increment under the row lock), so two concurrent issuers never get the same number. A new
	 * year's sequence keeps the format of the latest earlier year (its prefix with the year replaced, its padding), so
	 * a format set in the settings carries over; else `prefix` and `padLength`.
	 */
	async takeNext(
		tx: ClinicalTx,
		input: { clinicId: string; key: string; year: number; prefix: string; padLength: number },
	): Promise<IssuedSequenceValue> {
		const [row] = await tx.$queryRaw<{ value: number; prefix: string | null; pad_length: number }[]>`
			WITH earlier AS (
				SELECT replace(prefix, year::text, ${String(input.year)}) AS prefix, pad_length
				FROM document_sequences
				WHERE clinic_id = ${input.clinicId}::uuid AND key = ${input.key} AND year < ${input.year}
				ORDER BY year DESC
				LIMIT 1
			)
			INSERT INTO document_sequences (id, clinic_id, key, year, prefix, next_value, pad_length)
			VALUES (gen_random_uuid(), ${input.clinicId}::uuid, ${input.key}, ${input.year},
				coalesce((SELECT prefix FROM earlier), ${input.prefix}), 2,
				coalesce((SELECT pad_length FROM earlier), ${input.padLength}))
			ON CONFLICT (clinic_id, key, year)
				DO UPDATE SET next_value = document_sequences.next_value + 1
			RETURNING next_value - 1 AS value, prefix, pad_length`;
		return { value: Number(row.value), prefix: row.prefix, padLength: row.pad_length };
	}

	/** The clinic's sequences of `year`, and of the latest earlier year (to show the format a new year starts from). */
	listUpTo(tx: ClinicalTx, clinicId: string, year: number): Promise<DocumentSequence[]> {
		return tx.documentSequence.findMany({
			where: { clinicId, year: { lte: year } },
			orderBy: [{ key: 'asc' }, { year: 'desc' }],
		});
	}

	/** Sets the format of the clinic's `key` sequence for `year`, creating it (numbering from 1) when missing. */
	upsertFormat(
		tx: ClinicalTx,
		input: { clinicId: string; key: string; year: number; prefix: string; padLength: number },
	): Promise<DocumentSequence> {
		const { clinicId, key, year, prefix, padLength } = input;
		return tx.documentSequence.upsert({
			where: { clinicId_key_year: { clinicId, key, year } },
			create: { clinicId, key, year, prefix, padLength, nextValue: 1 },
			update: { prefix, padLength },
		});
	}
}
