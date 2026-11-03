import { randomUUID } from 'node:crypto';

/** HL7 v2 acknowledgment codes (original mode). Enhanced-mode commit codes (CA/CE/CR) are read as these. */
export type AckCode = 'AA' | 'AE' | 'AR';

/** The MSH fields the connector routes and acknowledges by. Never the message body: logs only see these. */
export interface MshHeader {
	fieldSeparator: string;
	encodingCharacters: string;
	sendingApplication: string;
	sendingFacility: string;
	receivingApplication: string;
	receivingFacility: string;
	/** MSH-9, e.g. `ORU^R01^ORU_R01`. */
	messageType: string;
	/** MSH-10: the id the hub deduplicates by. */
	controlId: string;
	processingId: string;
	version: string;
}

export interface ParsedAck {
	code: AckCode;
	/** MSA-2: the control id of the message being acknowledged. */
	controlId: string;
	text: string;
}

/** Segments end in `\r` (HL7 v2 §2.5); some senders use `\n` or `\r\n`, so those are folded into `\r`. */
export function normalizeSegments(message: string): string {
	return message
		.replace(/\r\n|\n/g, '\r')
		.replace(/\r+$/, '')
		.replace(/^\s+/, '');
}

/** Reads MSH, or null when the text is not an HL7 v2 message (no MSH first segment, or no MSH-10). */
export function parseMsh(message: string): MshHeader | null {
	const first = normalizeSegments(message).split('\r', 1)[0] ?? '';
	if (!first.startsWith('MSH') || first.length < 8) {
		return null;
	}
	const fieldSeparator = first[3];
	// MSH-1 is the separator itself, so MSH-n is fields[n - 1].
	const fields = first.split(fieldSeparator);
	const controlId = fields[9]?.trim() ?? '';
	if (!controlId) {
		return null;
	}
	return {
		fieldSeparator,
		encodingCharacters: fields[1] ?? '^~\\&',
		sendingApplication: fields[2] ?? '',
		sendingFacility: fields[3] ?? '',
		receivingApplication: fields[4] ?? '',
		receivingFacility: fields[5] ?? '',
		messageType: fields[8] ?? '',
		controlId,
		processingId: fields[10] ?? '',
		version: fields[11] ?? '',
	};
}

/** The queue orders delivery per sender: MSH-3 and MSH-4. */
export function senderKey(header: MshHeader): string {
	return `${header.sendingApplication}|${header.sendingFacility}`;
}

/** Reads MSA from an ACK, or null when there is no usable MSA-1. */
export function parseAck(ack: string): ParsedAck | null {
	const segments = normalizeSegments(ack).split('\r');
	const msh = parseMsh(ack);
	const separator = msh?.fieldSeparator ?? '|';
	const msa = segments.find((segment) => segment.startsWith(`MSA${separator}`));
	if (!msa) {
		return null;
	}
	const fields = msa.split(separator);
	const code = toAckCode(fields[1]?.trim() ?? '');
	if (!code) {
		return null;
	}
	return { code, controlId: fields[2] ?? '', text: fields[3] ?? '' };
}

function toAckCode(value: string): AckCode | null {
	switch (value.toUpperCase()) {
		case 'AA':
		case 'CA':
			return 'AA';
		case 'AE':
		case 'CE':
			return 'AE';
		case 'AR':
		case 'CR':
			return 'AR';
		default:
			return null;
	}
}

export interface BuildAckOptions {
	/** MSA-3 text, e.g. why the message was rejected. Escaped for HL7. */
	text?: string;
	/** The ACK's own MSH-10. Defaults to a random 20-character id. */
	controlId?: string;
	now?: Date;
	/** Used when there is no header to answer (the inbound text was not HL7). */
	fallback?: { application: string; facility: string };
}

/**
 * Builds an ACK for `header` (sender and receiver swapped, MSA-2 = its MSH-10). With no header (unparseable input) it
 * still returns a valid ACK, from `fallback`, with an empty MSA-2.
 */
export function buildAck(header: MshHeader | null, code: AckCode, options: BuildAckOptions = {}): string {
	const separator = header?.fieldSeparator ?? '|';
	const encoding = header?.encodingCharacters || '^~\\&';
	const trigger = header?.messageType.split(encoding[0] ?? '^')[1] ?? '';
	const messageType = trigger ? ['ACK', trigger, 'ACK'].join(encoding[0] ?? '^') : 'ACK';
	const msh = [
		'MSH',
		encoding,
		header?.receivingApplication ?? options.fallback?.application ?? '',
		header?.receivingFacility ?? options.fallback?.facility ?? '',
		header?.sendingApplication ?? '',
		header?.sendingFacility ?? '',
		formatTimestamp(options.now ?? new Date()),
		'',
		messageType,
		options.controlId ?? randomUUID().replace(/-/g, '').slice(0, 20),
		header?.processingId || 'P',
		header?.version || '2.5.1',
	].join(separator);
	const msa = ['MSA', code, header?.controlId ?? ''];
	if (options.text) {
		msa.push(escapeText(options.text, separator, encoding));
	}
	return `${msh}\r${msa.join(separator)}`;
}

/** HL7 escape sequences (§2.7) for free text placed in a field. */
export function escapeText(text: string, separator = '|', encoding = '^~\\&'): string {
	const [component = '^', repetition = '~', escape = '\\', subcomponent = '&'] = encoding;
	const map: Record<string, string> = {
		[escape]: `${escape}E${escape}`,
		[separator]: `${escape}F${escape}`,
		[component]: `${escape}S${escape}`,
		[repetition]: `${escape}R${escape}`,
		[subcomponent]: `${escape}T${escape}`,
	};
	return [...text.replace(/[\r\n]+/g, ' ')].map((char) => map[char] ?? char).join('');
}

/** HL7 TS (`YYYYMMDDHHMMSS+0000`), in UTC. */
export function formatTimestamp(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return (
		`${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
		`${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}+0000`
	);
}
