import { Injectable } from '@nestjs/common';

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
	 * statement (insert or increment under the row lock), so two concurrent issuers never get the same number.
	 */
	async takeNext(
		tx: ClinicalTx,
		input: { clinicId: string; key: string; year: number; prefix: string; padLength: number },
	): Promise<IssuedSequenceValue> {
		const [row] = await tx.$queryRaw<{ value: number; prefix: string | null; pad_length: number }[]>`
			INSERT INTO document_sequences (id, clinic_id, key, year, prefix, next_value, pad_length)
			VALUES (gen_random_uuid(), ${input.clinicId}::uuid, ${input.key}, ${input.year}, ${input.prefix}, 2,
				${input.padLength})
			ON CONFLICT (clinic_id, key, year)
				DO UPDATE SET next_value = document_sequences.next_value + 1
			RETURNING next_value - 1 AS value, prefix, pad_length`;
		return { value: Number(row.value), prefix: row.prefix, padLength: row.pad_length };
	}
}
