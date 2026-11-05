import { randomBytes } from 'node:crypto';

/**
 * HL7 v2 ORM^O01 (general order) for an order sent to a lab or imaging facility (DESIGN.md §9). Pure: it takes the
 * order as plain values and returns the message, segments joined by carriage returns. The edge connector forwards it
 * over MLLP to the facility's lab system and posts the ACK back.
 *
 * Lengths: MSH-10 fits v2.3.1's 20 characters. ORC-2 / OBR-2 (placer order number, EI, 22 in v2.3.1) carry the
 * 36-character order id plus the `LOOPWISE` namespace, longer than the standard's 22; the ORU ingest matches results
 * back on that id. Lab systems that truncate placer numbers would need a short order number column (not built).
 */

export type OrderControl = 'NW' | 'CA';

export interface OrmFacility {
	/** The facility's slug, used as its HL7 namespace (MSH-4/6, assigning authority). */
	slug: string;
	name: string;
}

export interface OrmIdentifier {
	system: string;
	value: string;
	/** The facility that issued it (its slug). */
	facilitySlug: string;
}

export interface OrmInput {
	/** MSH-10, unique per message, at most 20 characters (`hl7ControlId`). */
	controlId: string;
	/** MSH-7 and ORC-9. */
	at: Date;
	/** NW for a new order, CA to cancel one the lab already has. */
	orderControl: OrderControl;
	sending: OrmFacility;
	receiving: OrmFacility;
	patient: {
		id: string;
		familyName: string;
		givenName: string;
		birthDate: Date;
		sex: 'female' | 'male' | 'other' | 'unknown';
		phone: string | null;
		/** The patient's identifiers; those issued by the receiving facility go first (PID-3). */
		identifiers: readonly OrmIdentifier[];
	};
	order: {
		/** The placer order number (ORC-2, OBR-2). */
		id: string;
		code: string;
		codeSystem: string;
		display: string | null;
		priority: 'routine' | 'urgent' | 'stat';
		notes: string | null;
		createdAt: Date;
	};
	orderingProvider: { id: string; name: string };
}

/** The application that sends and the namespace of placer order numbers and patient ids. */
export const HL7_APPLICATION = 'LOOPWISE';
const HL7_VERSION = '2.3.1';
const SEGMENT_SEPARATOR = '\r';

/** MSH-10 is ST(20) in HL7 v2.3.1: strict lab systems reject a longer message control id. */
export const MAX_CONTROL_ID_LENGTH = 20;

/**
 * A message control id that fits MSH-10: `LW`, the time in base 36 (8 characters until 2059) and 10 random base-36
 * characters (about 51 bits), so ids never repeat in practice and sort roughly by time. The outbox's unique index
 * on `control_id` backs this up.
 */
export function hl7ControlId(now = new Date(), random: (size: number) => Uint8Array = randomBytes): string {
	const time = now.getTime().toString(36).toUpperCase().padStart(8, '0');
	const tail = [...random(10)].map((byte) => (byte % 36).toString(36).toUpperCase()).join('');
	return `LW${time}${tail}`.slice(0, MAX_CONTROL_ID_LENGTH);
}

/** Escapes a value for an HL7 field (delimiters `|^~\&`, and line breaks as hex escapes). */
export function escapeHl7(value: string): string {
	return value
		.replace(/\\/g, '\\E\\')
		.replace(/\|/g, '\\F\\')
		.replace(/\^/g, '\\S\\')
		.replace(/&/g, '\\T\\')
		.replace(/~/g, '\\R\\')
		.replace(/\r\n?|\n/g, '\\X0D0A\\');
}

/** Philippine time, the facilities' clock: `YYYYMMDDHHMMSS+0800`. */
export function hl7DateTime(date: Date): string {
	const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
	return `${local.toISOString().replace(/[-:T]/g, '').slice(0, 14)}+0800`;
}

/** A date-only value (birth date, stored as UTC midnight): `YYYYMMDD`. */
export function hl7Date(date: Date): string {
	return date.toISOString().slice(0, 10).replace(/-/g, '');
}

const PRIORITY: Record<OrmInput['order']['priority'], string> = { routine: 'R', urgent: 'A', stat: 'S' };
const SEX: Record<OrmInput['patient']['sex'], string> = { female: 'F', male: 'M', other: 'O', unknown: 'U' };
/** PID-3 identifier type codes (HL7 table 0203). */
const IDENTIFIER_TYPE: Record<string, string> = { MRN: 'MR', PhilHealth: 'NH' };

/** Fields of one segment, each already escaped or built from escaped components; trailing empties dropped. */
function segment(name: string, fields: readonly string[]): string {
	const trimmed = [...fields];
	while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
		trimmed.pop();
	}
	return [name, ...trimmed].join('|');
}

/** Components of one field, each escaped; trailing empties dropped. */
function components(...values: readonly (string | null | undefined)[]): string {
	const escaped = values.map((value) => escapeHl7(value ?? ''));
	while (escaped.length > 0 && escaped[escaped.length - 1] === '') {
		escaped.pop();
	}
	return escaped.join('^');
}

function identifierField(input: OrmInput): string {
	const receiving = input.patient.identifiers.filter((id) => id.facilitySlug === input.receiving.slug);
	const others = input.patient.identifiers.filter((id) => id.facilitySlug !== input.receiving.slug);
	const authority = (id: OrmIdentifier) => (id.system === 'PhilHealth' ? 'PHILHEALTH' : id.facilitySlug);
	const seen = new Set<string>();
	const repetitions = [...receiving, ...others]
		.map((id) => components(id.value, '', '', authority(id), IDENTIFIER_TYPE[id.system] ?? id.system))
		.filter((value) => !seen.has(value) && seen.add(value));
	return [...repetitions, components(input.patient.id, '', '', HL7_APPLICATION, 'PI')].join('~');
}

export function buildOrmO01(input: OrmInput): string {
	if (input.controlId.length === 0 || input.controlId.length > MAX_CONTROL_ID_LENGTH) {
		throw new Error(`MSH-10 must be 1 to ${MAX_CONTROL_ID_LENGTH} characters`);
	}
	const { order, patient } = input;
	const at = hl7DateTime(input.at);
	const placer = components(order.id, HL7_APPLICATION);
	const provider = components(input.orderingProvider.id, input.orderingProvider.name);
	const priority = PRIORITY[order.priority];
	const service = components(order.code, order.display, order.codeSystem === 'LOINC' ? 'LN' : 'L');

	const msh = [
		'MSH',
		'^~\\&',
		HL7_APPLICATION,
		escapeHl7(input.sending.slug),
		'',
		escapeHl7(input.receiving.slug),
		at,
		'',
		'ORM^O01',
		escapeHl7(input.controlId),
		'P',
		HL7_VERSION,
	].join('|');
	const pid = segment('PID', [
		'1',
		'',
		identifierField(input),
		'',
		components(patient.familyName, patient.givenName),
		'',
		hl7Date(patient.birthDate),
		SEX[patient.sex],
		'',
		'',
		'',
		'',
		escapeHl7(patient.phone ?? ''),
	]);
	const pv1 = segment('PV1', ['1', 'O']);
	// ORC-7 quantity/timing carries the priority in component 6; ORC-21 the ordering facility.
	const orc = segment('ORC', [
		input.orderControl,
		placer,
		'',
		'',
		'',
		'',
		`^^^^^${priority}`,
		'',
		at,
		'',
		'',
		provider,
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		components(input.sending.name),
	]);
	const obr = segment('OBR', [
		'1',
		placer,
		'',
		service,
		priority,
		hl7DateTime(order.createdAt),
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		provider,
	]);
	const segments = [msh, pid, pv1, orc, obr];
	if (order.notes) {
		segments.push(segment('NTE', ['1', 'P', escapeHl7(order.notes)]));
	}
	return segments.join(SEGMENT_SEPARATOR);
}
