import { escapeHl7, field, findSegment, type Hl7Delimiters, type Hl7Message } from './hl7-parser.js';

export type AckCode = 'AA' | 'AE' | 'AR';

const DEFAULT_DELIMITERS: Hl7Delimiters = {
	field: '|',
	component: '^',
	repetition: '~',
	escape: '\\',
	subcomponent: '&',
};

export interface AckOptions {
	code: AckCode;
	/** The original MSH-10, echoed in MSA-2 ('' when it could not be read). */
	controlId: string;
	/** MSA-3: why the message was rejected (or a short confirmation). */
	text?: string;
	/** The original message, to address the ACK back to its sender. */
	original?: Hl7Message | null;
	now?: Date;
}

/**
 * An HL7 v2.5.1 general acknowledgment: MSH + MSA (+ ERR for AE/AR). AA = accepted, AE = application error, AR =
 * rejected. The connector retries only on 5xx; it must not resend an AE or AR.
 */
export function buildAck({ code, controlId, text, original, now = new Date() }: AckOptions): string {
	const d = original?.delimiters ?? DEFAULT_DELIMITERS;
	const msh = original ? findSegment(original, 'MSH') : undefined;
	const encoding = `${d.component}${d.repetition}${d.escape}${d.subcomponent}`;
	const trigger = msh?.fields[9]?.[0]?.[1]?.[0] ?? '';
	const version = field(msh, 12) || '2.5.1';
	const segments = [
		[
			'MSH',
			encoding,
			'LOOPWISE',
			'LOOPWISE',
			escapeHl7(field(msh, 3), d),
			escapeHl7(field(msh, 4), d),
			formatHl7Timestamp(now),
			'',
			`ACK${d.component}${trigger}${d.component}ACK`,
			`ACK${controlId ? `-${escapeHl7(controlId, d)}` : formatHl7Timestamp(now)}`,
			field(msh, 11) || 'P',
			version,
		].join(d.field),
		['MSA', code, escapeHl7(controlId, d), escapeHl7(text ?? '', d)].join(d.field),
	];
	if (code !== 'AA' && text) {
		// ERR-3 HL7 error code 207 (application internal error) / 200 (unsupported); ERR-4 severity E; ERR-8 text.
		const errorCode = code === 'AR' ? '200' : '207';
		segments.push(
			[
				'ERR',
				'',
				'',
				`${errorCode}${d.component}${code === 'AR' ? 'Unsupported' : 'Application error'}${d.component}HL70357`,
				'E',
				'',
				'',
				'',
				escapeHl7(text, d),
			].join(d.field),
		);
	}
	return segments.join('\r');
}

/** `YYYYMMDDHHMMSS+0800`, in Philippine time. */
export function formatHl7Timestamp(date: Date): string {
	const local = new Date(date.getTime() + 8 * 3_600_000);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}${pad(local.getUTCSeconds())}+0800`;
}
