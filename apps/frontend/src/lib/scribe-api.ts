import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import { RecordScribeConsentDocument, ScribeConsentDocument } from '@/graphql/generated/graphql';
import { getClinicRequestHeaders } from '@/lib/active-clinic';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['scribe'];
type Outputs = ApiOutputs['scribe'];

/**
 * The AI scribe (`apps/api/src/clinical/scribe`): the visit's recording consent, and consent-checked transcription.
 * Drafting is a Wise chat message; each card confirms through its own record's API.
 */
export const scribeApi = {
	scribe: {
		consent: query<Inputs['consent'], Outputs['consent']>(
			['scribe', 'consent'],
			async ({ encounterId }) => (await runQuery(ScribeConsentDocument, { encounterId })).scribeConsent,
		),
		recordConsent: mutation<Inputs['recordConsent'], Outputs['recordConsent']>(
			['scribe', 'recordConsent'],
			async (input) => (await runMutation(RecordScribeConsentDocument, { input })).recordScribeConsent,
		),
	},
};

/** `POST /api/scribe/transcribe`: one recording of the visit (base64) to text; refused without the patient's consent. */
export async function transcribeVisit(encounterId: string, audio: string): Promise<{ text: string }> {
	const response = await fetch('/api/scribe/transcribe', {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...getClinicRequestHeaders() },
		body: JSON.stringify({ encounterId, audio }),
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
		throw new Error(body?.message ?? body?.error ?? 'Transcription failed');
	}
	return response.json();
}
