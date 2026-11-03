import { getProjectRequestHeaders } from '@/lib/active-project';

/** `POST /api/transcribe` on apps/api (upstream tRPC `transcribe.transcribe`): base64 audio in, text out. */
export async function transcribeAudio(input: {
	audio: string;
	provider?: 'openai';
	modelId?: string;
}): Promise<{ text: string }> {
	const response = await fetch('/api/transcribe', {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...getProjectRequestHeaders() },
		body: JSON.stringify(input),
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
		throw new Error(body?.error ?? body?.message ?? 'Transcription failed');
	}
	return response.json();
}
