import { Injectable } from '@nestjs/common';

import { AuditService } from '../../audit/audit.service.js';
import { auditChanges } from '../../audit/audit-changes.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import type { ClinicActor } from '../clinic-admin-actor.js';
import { InvalidSequenceFormatError, UnknownSequenceKeyError } from '../clinic-setup.errors.js';
import { DocumentSequenceRepository } from './document-sequence.repository.js';
import {
	DEFAULT_PAD_LENGTH,
	defaultSequencePrefix,
	DOCUMENT_SEQUENCE_KEYS,
	type DocumentSequenceKey,
	formatSequenceNumber,
	manilaYear,
} from './document-sequence.service.js';
import {
	DOCUMENT_SEQUENCE_LABELS,
	type DocumentSequenceSetting,
	type SetDocumentSequenceInput,
} from './models/document-sequence-setting.model.js';

const PREFIX_CHARACTERS = /^[A-Za-z0-9\-/]*$/;

/**
 * Settings → Clinic → Numbering: the prefix and padding of each numbered document this year. A format set here
 * carries into the next year with the year replaced (`DocumentSequenceRepository.takeNext`), so the prefix must
 * contain the year: numbers restart each year and would otherwise repeat. Clinic staff write `document_sequences`
 * under row-level security; the resolver keeps it to admins.
 */
@Injectable()
export class DocumentSequenceSettingsService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly sequences: DocumentSequenceRepository,
		private readonly audit: AuditService,
	) {}

	/** Every numbered document of the clinic, with this year's format (or the one it will start with). */
	list(actor: ClinicActor, now: Date = new Date()): Promise<DocumentSequenceSetting[]> {
		const year = manilaYear(now);
		return this.db.asUser(actor.userId, async (tx) => {
			const rows = await this.sequences.listUpTo(tx, actor.clinicId, year);
			return keys().map((key) => {
				const current = rows.find((row) => row.key === key && row.year === year);
				if (current) {
					return setting(key, year, current.prefix ?? '', current.padLength, current.nextValue, true);
				}
				const earlier = rows.find((row) => row.key === key && row.year !== null && row.year < year);
				const prefix = earlier?.prefix
					? earlier.prefix.replaceAll(String(earlier.year), String(year))
					: defaultSequencePrefix(actor.clinicCode, key, year);
				return setting(key, year, prefix, earlier?.padLength ?? DEFAULT_PAD_LENGTH, 1, false);
			});
		});
	}

	/** Sets this year's prefix and padding of `key`; the running value is kept. Audited. */
	async set(
		actor: ClinicActor,
		input: SetDocumentSequenceInput,
		now: Date = new Date(),
	): Promise<DocumentSequenceSetting> {
		const key = input.key as DocumentSequenceKey;
		if (!(key in DOCUMENT_SEQUENCE_KEYS)) {
			throw new UnknownSequenceKeyError(input.key);
		}
		const year = manilaYear(now);
		const prefix = input.prefix.trim();
		if (!PREFIX_CHARACTERS.test(prefix)) {
			throw new InvalidSequenceFormatError("A prefix has only letters, digits, '-' and '/'.");
		}
		if (!prefix.includes(String(year))) {
			throw new InvalidSequenceFormatError(
				`Put the year (${year}) in the prefix: numbers restart every year, so without it they would repeat.`,
			);
		}
		return this.db.asUser(actor.userId, async (tx) => {
			const before = (await this.sequences.listUpTo(tx, actor.clinicId, year)).find(
				(row) => row.key === key && row.year === year,
			);
			const row = await this.sequences.upsertFormat(tx, {
				clinicId: actor.clinicId,
				key,
				year,
				prefix,
				padLength: input.padLength,
			});
			await this.audit.record(tx, {
				action: before ? 'UPDATE' : 'CREATE',
				event: 'document_sequence.update',
				entityType: 'DocumentSequence',
				entityId: row.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: auditChanges(before ? { prefix: before.prefix, padLength: before.padLength } : null, {
					prefix: row.prefix,
					padLength: row.padLength,
				}),
			});
			return setting(key, year, row.prefix ?? '', row.padLength, row.nextValue, true);
		});
	}
}

function keys(): DocumentSequenceKey[] {
	return Object.keys(DOCUMENT_SEQUENCE_KEYS) as DocumentSequenceKey[];
}

function setting(
	key: DocumentSequenceKey,
	year: number,
	prefix: string,
	padLength: number,
	nextValue: number,
	isStarted: boolean,
): DocumentSequenceSetting {
	return {
		key,
		label: DOCUMENT_SEQUENCE_LABELS[key],
		year,
		prefix,
		padLength,
		nextValue,
		preview: formatSequenceNumber(prefix, nextValue, padLength),
		isStarted,
	};
}
