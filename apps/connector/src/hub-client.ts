import { type AckCode, parseAck } from './hl7.ts';

/**
 * HTTPS client for the hub's HL7 endpoints (DESIGN.md §11), authenticated with the facility API key:
 *
 * - `POST /api/hl7/messages` (text/plain HL7 in, HL7 ACK out; idempotent per MSH-10)
 * - `GET /api/hl7/outbox?limit=` (orders waiting for this facility's LIS)
 * - `POST /api/hl7/outbox/:id/ack` (the LIS ACK for one of them)
 *
 * Every call resolves to an outcome, never throws: callers decide between retry, stop and fail.
 */
export type HubFailure =
	/** 401/403: the facility key is wrong or revoked. Retrying cannot help; the connector halts and alerts. */
	| { kind: 'unauthorized'; status: number }
	/** Network error, timeout, 408, 429 or 5xx: retry with backoff. */
	| { kind: 'transient'; error: string }
	/** Any other 4xx: the hub will never take this request as it is. */
	| { kind: 'rejected'; status: number; error: string };

export type HubPostResult = { kind: 'ack'; code: AckCode; ack: string } | HubFailure;

export interface OutboxItem {
	id: string;
	message: string;
}

export type HubOutboxResult = { kind: 'ok'; items: OutboxItem[] } | HubFailure;

export type HubOutboxAckResult = { kind: 'ok' } | HubFailure;

export interface HubClientOptions {
	hubUrl: string;
	facilityKey: string;
	timeoutMs: number;
	fetch?: typeof fetch;
}

export class HubClient {
	private readonly baseUrl: string;
	private readonly facilityKey: string;
	private readonly timeoutMs: number;
	private readonly fetchImpl: typeof fetch;

	constructor(options: HubClientOptions) {
		this.baseUrl = options.hubUrl.replace(/\/+$/, '');
		this.facilityKey = options.facilityKey;
		this.timeoutMs = options.timeoutMs;
		this.fetchImpl = options.fetch ?? fetch;
	}

	async postMessage(message: string): Promise<HubPostResult> {
		const response = await this.request('/api/hl7/messages', {
			method: 'POST',
			headers: { 'content-type': 'text/plain; charset=utf-8' },
			body: message,
		});
		if ('kind' in response) {
			return response;
		}
		const ack = parseAck(response.body);
		if (!ack) {
			// A 200 without a usable MSA is a hub fault, not a verdict on the message.
			return { kind: 'transient', error: 'hub returned 200 without an MSA acknowledgment code' };
		}
		return { kind: 'ack', code: ack.code, ack: response.body };
	}

	async fetchOutbox(limit: number): Promise<HubOutboxResult> {
		const response = await this.request(`/api/hl7/outbox?limit=${limit}`, {
			method: 'GET',
			headers: { accept: 'application/json' },
		});
		if ('kind' in response) {
			return response;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(response.body);
		} catch {
			return { kind: 'transient', error: 'hub outbox response is not JSON' };
		}
		if (!Array.isArray(parsed)) {
			return { kind: 'transient', error: 'hub outbox response is not an array' };
		}
		const items = parsed.filter(
			(item): item is OutboxItem =>
				typeof item === 'object' &&
				item !== null &&
				typeof (item as OutboxItem).id === 'string' &&
				typeof (item as OutboxItem).message === 'string',
		);
		return { kind: 'ok', items };
	}

	async ackOutbox(id: string, code: AckCode, ack: string): Promise<HubOutboxAckResult> {
		const response = await this.request(`/api/hl7/outbox/${encodeURIComponent(id)}/ack`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ code, ack }),
		});
		return 'kind' in response ? response : { kind: 'ok' };
	}

	private async request(pathAndQuery: string, init: RequestInit): Promise<{ body: string } | HubFailure> {
		let response: Response;
		try {
			response = await this.fetchImpl(`${this.baseUrl}${pathAndQuery}`, {
				...init,
				headers: { ...init.headers, authorization: `Bearer ${this.facilityKey}` },
				signal: AbortSignal.timeout(this.timeoutMs),
			});
		} catch (error) {
			return { kind: 'transient', error: describeFetchError(error) };
		}
		// Bodies are read in full (keeps the socket reusable) but never put in an error text: they may echo PHI.
		const body = await response.text().catch(() => '');
		if (response.ok) {
			return { body };
		}
		const status = response.status;
		if (status === 401 || status === 403) {
			return { kind: 'unauthorized', status };
		}
		if (status === 408 || status === 429 || status >= 500) {
			return { kind: 'transient', error: `hub responded ${status}` };
		}
		return { kind: 'rejected', status, error: `hub responded ${status}` };
	}
}

function describeFetchError(error: unknown): string {
	if (error instanceof Error) {
		if (error.name === 'TimeoutError') {
			return 'hub request timed out';
		}
		const cause = (error as Error & { cause?: { code?: string } }).cause;
		return cause?.code ? `${error.message} (${cause.code})` : error.message;
	}
	return String(error);
}
