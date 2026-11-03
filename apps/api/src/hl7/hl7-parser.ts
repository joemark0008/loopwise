/**
 * A small HL7 v2 parser: segments, fields, repetitions, components, subcomponents and escape sequences. Pure (no
 * Nest, no I/O), so the ingest, the tests and the demo scripts share it.
 *
 * Positions follow the HL7 spec, 1-based: `field(msh, 10)` is MSH-10. MSH-1 is the field separator itself and MSH-2
 * the encoding characters, so MSH fields are shifted by one compared with the split text.
 */

export interface Hl7Delimiters {
	field: string;
	component: string;
	repetition: string;
	escape: string;
	subcomponent: string;
}

/** A field value: its repetitions, each a list of components, each a list of subcomponents (all unescaped). */
export type Hl7Field = string[][][];

export interface Hl7Segment {
	name: string;
	/** Index i holds field i (index 0 is unused, so positions match the spec). */
	fields: Hl7Field[];
}

export interface Hl7Message {
	delimiters: Hl7Delimiters;
	segments: Hl7Segment[];
}

export class Hl7ParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'Hl7ParseError';
	}
}

/** Splits on CR (the standard), tolerating LF and CRLF from hand-written samples. */
export function splitSegments(raw: string): string[] {
	return raw
		.split(/\r\n|\r|\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

export function parseHl7(raw: string): Hl7Message {
	const lines = splitSegments(raw.replace(/^\uFEFF/, ''));
	if (lines.length === 0 || !lines[0].startsWith('MSH') || lines[0].length < 8) {
		throw new Hl7ParseError('The message does not start with an MSH segment');
	}
	const header = lines[0];
	const delimiters: Hl7Delimiters = {
		field: header[3],
		component: header[4],
		repetition: header[5],
		escape: header[6],
		subcomponent: header[7],
	};
	const special = Object.values(delimiters);
	if (new Set(special).size !== 5 || special.some((char) => /[A-Za-z0-9\s]/.test(char))) {
		throw new Hl7ParseError('MSH-1/MSH-2 do not declare valid delimiters');
	}

	const segments = lines.map((line): Hl7Segment => {
		const parts = line.split(delimiters.field);
		const name = parts[0];
		if (!/^[A-Z][A-Z0-9]{2}$/.test(name)) {
			throw new Hl7ParseError(`Invalid segment name "${name.slice(0, 10)}"`);
		}
		if (name === 'MSH') {
			// MSH-1 is the separator and MSH-2 the encoding characters: kept verbatim, never split.
			const rest = parts.slice(2).map((text) => parseField(text, delimiters));
			return { name, fields: [[], [[[delimiters.field]]], [[[parts[1]]]], ...rest] };
		}
		return { name, fields: [[], ...parts.slice(1).map((text) => parseField(text, delimiters))] };
	});
	return { delimiters, segments };
}

function parseField(text: string, d: Hl7Delimiters): Hl7Field {
	if (text === '') {
		return [];
	}
	return text
		.split(d.repetition)
		.map((repetition) =>
			repetition
				.split(d.component)
				.map((component) => component.split(d.subcomponent).map((sub) => unescapeHl7(sub, d))),
		);
}

/** Resolves `\F\ \S\ \T\ \R\ \E\`, `\.br\` (line break) and `\Xhh..\` (hex); other escapes are dropped. */
export function unescapeHl7(text: string, d: Hl7Delimiters): string {
	if (!text.includes(d.escape)) {
		return text;
	}
	let out = '';
	let i = 0;
	while (i < text.length) {
		const char = text[i];
		if (char !== d.escape) {
			out += char;
			i += 1;
			continue;
		}
		const end = text.indexOf(d.escape, i + 1);
		if (end === -1) {
			out += text.slice(i);
			break;
		}
		const code = text.slice(i + 1, end);
		out += resolveEscape(code, d);
		i = end + 1;
	}
	return out;
}

function resolveEscape(code: string, d: Hl7Delimiters): string {
	switch (code) {
		case 'F':
			return d.field;
		case 'S':
			return d.component;
		case 'T':
			return d.subcomponent;
		case 'R':
			return d.repetition;
		case 'E':
			return d.escape;
		case '.br':
			return '\n';
	}
	if (/^X([0-9A-Fa-f]{2})+$/.test(code)) {
		return Buffer.from(code.slice(1), 'hex').toString('latin1');
	}
	// Highlighting (\H\ \N\), character set switches and anything unknown: no text of their own.
	return '';
}

export function escapeHl7(text: string, d: Hl7Delimiters): string {
	return text
		.split(d.escape)
		.map((part) =>
			part
				.split(d.field)
				.join(`${d.escape}F${d.escape}`)
				.split(d.component)
				.join(`${d.escape}S${d.escape}`)
				.split(d.subcomponent)
				.join(`${d.escape}T${d.escape}`)
				.split(d.repetition)
				.join(`${d.escape}R${d.escape}`)
				.replace(/\r\n|\r|\n/g, `${d.escape}.br${d.escape}`),
		)
		.join(`${d.escape}E${d.escape}`);
}

export function findSegment(message: Hl7Message, name: string): Hl7Segment | undefined {
	return message.segments.find((segment) => segment.name === name);
}

/** The repetitions of a field (empty when absent). */
export function repetitions(segment: Hl7Segment | undefined, position: number): string[][][] {
	return segment?.fields[position] ?? [];
}

/**
 * One component of a field, '' when absent. Subcomponents are joined with `&`, which only matters for fields this
 * parser's callers do not read by subcomponent.
 */
export function component(
	segment: Hl7Segment | undefined,
	position: number,
	componentIndex = 1,
	repetition = 0,
): string {
	return segment?.fields[position]?.[repetition]?.[componentIndex - 1]?.join('&') ?? '';
}

/** The first component of a field: the whole value for simple fields. */
export function field(segment: Hl7Segment | undefined, position: number): string {
	return component(segment, position, 1);
}
