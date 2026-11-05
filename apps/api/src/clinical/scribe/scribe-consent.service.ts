import { RECORDING_CONSENT_TYPE, RECORDING_CONSENT_VERSION } from '@loopwise/shared/scribe';
import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../common/errors/domain-error.js';
import type { ConsentType } from '../../generated/prisma/client.js';
import { TranscribeService } from '../../transcribe/transcribe.service.js';
import { AuditService } from '../audit/audit.service.js';
import { auditSnapshot } from '../audit/audit-changes.js';
import { EncounterService } from '../encounters/encounter.service.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { RecordScribeConsentInput, ScribeTranscribeBody } from './dto/scribe.input.js';
import { type RecordingConsent, toRecordingConsent } from './models/recording-consent.model.js';
import { RecordingConsentRequiredError } from './scribe.errors.js';
import { ScribeConsentRepository } from './scribe-consent.repository.js';

const CONSENT_TYPE = RECORDING_CONSENT_TYPE satisfies ConsentType;

/**
 * Recording a consult for the AI scribe (PLAN.md §4.3, DESIGN.md §8.7). Before recording, the doctor asks the patient
 * and records the answer as a visit-specific consent (`patient_consents`, type PHOTO_VIDEO, the version of the text
 * read, granted or not); the latest answer counts. Transcription is refused without it, on the server, so a recording
 * never leaves the clinic without consent; typing a dictation needs none. The audio is passed to the clinic's
 * transcription provider and not kept.
 */
@Injectable()
export class ScribeConsentService {
	private readonly logger = new Logger(ScribeConsentService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly consents: ScribeConsentRepository,
		private readonly encounterAccess: EncounterService,
		private readonly audit: AuditService,
		private readonly transcribe: TranscribeService,
	) {}

	/** The visit's latest recording consent (null when never asked), as the user; audited when there is one. */
	async forEncounter(userId: string, encounterId: string): Promise<RecordingConsent | null> {
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.encounterAccess.findReadable(tx, encounterId);
			if (!encounter) {
				throw new EntityNotFoundError('Encounter', encounterId);
			}
			const row = await this.consents.findLatest(tx, encounterId, CONSENT_TYPE);
			if (row) {
				await this.audit.view(tx, {
					event: 'consent.view',
					entityType: 'PatientConsent',
					entityId: row.id,
					userId,
					patientId: encounter.patientId,
					organizationId: encounter.organizationId,
					clinicId: encounter.clinicId,
				});
			}
			return row && toRecordingConsent(row);
		});
	}

	/** Records the patient's answer for the visit, witnessed by the user (staff of the visit's clinic). */
	async record(userId: string, input: RecordScribeConsentInput): Promise<RecordingConsent> {
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.encounterAccess.requireWritable(tx, userId, input.encounterId);
			const row = await this.consents.create(tx, {
				patientId: encounter.patientId,
				encounterId: encounter.id,
				type: CONSENT_TYPE,
				version: RECORDING_CONSENT_VERSION,
				granted: input.granted,
				signedBy: input.signedBy?.trim() || null,
				witnessedById: userId,
			});
			await this.audit.created(tx, {
				event: input.granted ? 'consent.grant' : 'consent.refuse',
				entityType: 'PatientConsent',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: { after: auditSnapshot(row) },
				reason: 'Recording a consult for the AI scribe',
			});
			return toRecordingConsent(row);
		});
	}

	/**
	 * Transcribes one recording of the visit with the clinic's provider, only while the patient's consent stands. The
	 * audit row (EXPORT: the audio leaves for the provider) is written before the audio is sent; nothing is stored.
	 */
	async transcribeVisit(userId: string, body: ScribeTranscribeBody): Promise<{ text: string }> {
		const encounter = await this.db.asUser(userId, async (tx) => {
			const visit = await this.encounterAccess.requireWritable(tx, userId, body.encounterId);
			const consent = await this.consents.findLatest(tx, visit.id, CONSENT_TYPE);
			if (!consent?.granted || consent.revokedAt) {
				throw new RecordingConsentRequiredError(visit.encounterNo);
			}
			await this.audit.record(tx, {
				action: 'EXPORT',
				event: 'scribe.transcribe',
				entityType: 'Encounter',
				entityId: visit.id,
				userId,
				patientId: visit.patientId,
				organizationId: visit.organizationId,
				clinicId: visit.clinicId,
				reason: 'AI scribe: audio sent for transcription, not kept',
				changes: { after: { consentId: consent.id, audioBytes: Math.floor((body.audio.length * 3) / 4) } },
			});
			return visit;
		});
		const text = await this.transcribe.transcribeAudio(encounter.clinicId, body.audio);
		this.logger.log(`Transcribed a recording of ${encounter.encounterNo} (${text.length} characters)`);
		return { text };
	}
}
