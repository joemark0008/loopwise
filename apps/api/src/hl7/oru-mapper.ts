import { component, field, findSegment, type Hl7Message, type Hl7Segment, repetitions } from './hl7-parser.js';

/**
 * ORU^R01 → the normalized, FHIR-shaped result the ingest stores (DESIGN.md §4.3, §9). Pure: no database, no clock
 * except the timezone default.
 */

export type NormalizedSex = 'female' | 'male' | 'other' | 'unknown';
export type NormalizedFlag = 'normal' | 'low' | 'high' | 'abnormal' | 'critical_low' | 'critical_high';

export interface PatientIdentifier {
	value: string;
	/** PID-3.4, e.g. `THC` or `PhilHealth`. */
	assigningAuthority: string;
	/** PID-3.5, e.g. `MR` (medical record number) or `NH` / `PHIC` (national health insurance). */
	typeCode: string;
}

export interface NormalizedPatient {
	identifiers: PatientIdentifier[];
	familyName: string;
	givenName: string;
	/** `YYYY-MM-DD`, or null when PID-7 is missing or invalid. */
	birthDate: string | null;
	sex: NormalizedSex;
}

export interface NormalizedObservation {
	setId: string;
	valueType: 'NM' | 'ST' | 'TX' | 'FT';
	code: string;
	codeSystem: string;
	display: string | null;
	value: string;
	valueNumeric: number | null;
	unit: string | null;
	referenceRange: string | null;
	flag: NormalizedFlag | null;
	status: string;
	observedAt: Date | null;
}

export interface NormalizedOrder {
	/** ORC-2 / OBR-2: the ordering system's number; for orders Loopwise sent, the `ClinicalOrder` id. */
	placerOrderNumber: string | null;
	/** OBR-3 (or ORC-3): the lab's own accession number. */
	fillerOrderNumber: string | null;
	code: string;
	codeSystem: string;
	display: string | null;
	/** OBR-7 / OBR-22: when the result was produced, the fallback for observations without OBX-14. */
	resultedAt: Date | null;
	observations: NormalizedObservation[];
}

export interface NormalizedOru {
	controlId: string;
	messageType: string;
	sendingApplication: string;
	sendingFacility: string;
	sentAt: Date | null;
	patient: NormalizedPatient;
	orders: NormalizedOrder[];
}

/** Why a message cannot be stored as results. The ingest answers AE with this text. */
export class OruMappingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OruMappingError';
	}
}

export const SUPPORTED_VALUE_TYPES = ['NM', 'ST', 'TX', 'FT'] as const;

/** OBX-11 statuses that carry no usable result: deleted, wrong patient, cannot be obtained. */
const SKIPPED_STATUSES = new Set(['D', 'W', 'X']);

const CODE_SYSTEMS: Record<string, string> = {
	LN: 'LOINC',
	LOINC: 'LOINC',
	SCT: 'SNOMED',
	L: 'local',
	'99LOCAL': 'local',
};

const FLAGS: Record<string, NormalizedFlag> = {
	N: 'normal',
	L: 'low',
	H: 'high',
	A: 'abnormal',
	// "Critically abnormal" with no direction: kept as abnormal (ResultFlag has no undirected critical value).
	AA: 'abnormal',
	LL: 'critical_low',
	HH: 'critical_high',
};

const SEXES: Record<string, NormalizedSex> = { F: 'female', M: 'male', O: 'other', A: 'other', U: 'unknown' };

/** `MSH-9` as `ORU^R01` (the trigger and structure components, nothing more). */
export function messageTypeOf(message: Hl7Message): string {
	const msh = findSegment(message, 'MSH');
	return [component(msh, 9, 1), component(msh, 9, 2)].filter(Boolean).join('^');
}

export function controlIdOf(message: Hl7Message): string {
	return field(findSegment(message, 'MSH'), 10).trim();
}

/**
 * Maps an ORU^R01. `defaultOffset` is the UTC offset assumed for timestamps without one: facilities in the
 * Philippines send local time (UTC+8).
 */
export function mapOru(message: Hl7Message, defaultOffset = '+0800'): NormalizedOru {
	const msh = findSegment(message, 'MSH');
	const messageType = messageTypeOf(message);
	if (messageType !== 'ORU^R01') {
		throw new OruMappingError(`Unsupported message type ${messageType || '(empty)'}; expected ORU^R01`);
	}
	const controlId = controlIdOf(message);
	if (!controlId) {
		throw new OruMappingError('MSH-10 (message control id) is empty');
	}
	const pid = findSegment(message, 'PID');
	if (!pid) {
		throw new OruMappingError('The message has no PID segment');
	}

	const orders: NormalizedOrder[] = [];
	let currentOrc: Hl7Segment | undefined;
	let current: NormalizedOrder | undefined;
	for (const segment of message.segments) {
		if (segment.name === 'ORC') {
			currentOrc = segment;
		} else if (segment.name === 'OBR') {
			current = mapObr(segment, currentOrc, defaultOffset);
			orders.push(current);
			currentOrc = undefined;
		} else if (segment.name === 'OBX') {
			if (!current) {
				throw new OruMappingError('An OBX segment comes before any OBR');
			}
			addObservation(current, segment, defaultOffset);
		}
	}
	const withResults = orders.filter((order) => order.observations.length > 0);
	if (withResults.length === 0) {
		throw new OruMappingError('The message has no OBX results');
	}

	return {
		controlId,
		messageType,
		sendingApplication: field(msh, 3),
		sendingFacility: field(msh, 4),
		sentAt: parseHl7Timestamp(field(msh, 7), defaultOffset),
		patient: mapPid(pid),
		orders: withResults,
	};
}

function mapPid(pid: Hl7Segment): NormalizedPatient {
	const identifiers = repetitions(pid, 3)
		.map((rep) => ({
			value: (rep[0]?.[0] ?? '').trim(),
			assigningAuthority: (rep[3]?.[0] ?? '').trim(),
			typeCode: (rep[4]?.[0] ?? '').trim(),
		}))
		.filter((identifier) => identifier.value);
	// PID-2 (external id) and PID-19 (SSN) are deprecated; PID-3 is the patient identifier list.
	return {
		identifiers,
		familyName: component(pid, 5, 1).trim(),
		givenName: component(pid, 5, 2).trim(),
		birthDate: parseHl7Date(field(pid, 7)),
		sex: SEXES[field(pid, 8).trim().toUpperCase()] ?? 'unknown',
	};
}

function mapObr(obr: Hl7Segment, orc: Hl7Segment | undefined, defaultOffset: string): NormalizedOrder {
	return {
		placerOrderNumber: nonEmpty(field(obr, 2)) ?? nonEmpty(field(orc, 2)),
		fillerOrderNumber: nonEmpty(field(obr, 3)) ?? nonEmpty(field(orc, 3)),
		code: component(obr, 4, 1).trim(),
		codeSystem: codeSystem(component(obr, 4, 3)),
		display: nonEmpty(component(obr, 4, 2)),
		resultedAt: parseHl7Timestamp(field(obr, 22), defaultOffset) ?? parseHl7Timestamp(field(obr, 7), defaultOffset),
		observations: [],
	};
}

function addObservation(order: NormalizedOrder, obx: Hl7Segment, defaultOffset: string): void {
	const valueType = field(obx, 2).trim().toUpperCase();
	const status = field(obx, 11).trim().toUpperCase();
	if (SKIPPED_STATUSES.has(status)) {
		return;
	}
	if (!(SUPPORTED_VALUE_TYPES as readonly string[]).includes(valueType)) {
		throw new OruMappingError(`OBX-2 value type ${valueType || '(empty)'} is not supported (NM, ST, TX, FT)`);
	}
	const code = component(obx, 3, 1).trim();
	if (!code) {
		throw new OruMappingError('An OBX segment has no OBX-3 observation code');
	}
	const isText = valueType === 'TX' || valueType === 'FT';
	// Text values may repeat (one repetition per line); other types use the first component.
	const value = isText
		? repetitions(obx, 5)
				.map((rep) => rep.map((parts) => parts.join('&')).join('^'))
				.join('\n')
		: component(obx, 5, 1).trim();
	const subId = field(obx, 4);

	// A radiology report arrives as several TX OBX lines with the same code: one observation, one line each.
	const previous = order.observations.at(-1);
	if (
		isText &&
		previous &&
		previous.valueType === valueType &&
		previous.code === code &&
		previous.setId === `${code}:${subId}`
	) {
		previous.value = `${previous.value}\n${value}`;
		return;
	}

	let valueNumeric: number | null = null;
	if (valueType === 'NM') {
		valueNumeric = parseNumeric(value);
		if (valueNumeric === null) {
			throw new OruMappingError(`OBX-5 "${value.slice(0, 20)}" is not a number for NM observation ${code}`);
		}
	}
	order.observations.push({
		setId: `${code}:${subId}`,
		valueType: valueType as NormalizedObservation['valueType'],
		code,
		codeSystem: codeSystem(component(obx, 3, 3)),
		display: nonEmpty(component(obx, 3, 2)),
		value,
		valueNumeric,
		unit: nonEmpty(component(obx, 6, 1)),
		referenceRange: nonEmpty(field(obx, 7)),
		flag: FLAGS[field(obx, 8).trim().toUpperCase()] ?? null,
		status: status || 'F',
		observedAt:
			parseHl7Timestamp(field(obx, 14), defaultOffset) ?? parseHl7Timestamp(field(obx, 19), defaultOffset),
	});
}

function parseNumeric(value: string): number | null {
	if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(value)) {
		return null;
	}
	return Number(value);
}

function codeSystem(raw: string): string {
	const key = raw.trim().toUpperCase();
	return CODE_SYSTEMS[key] ?? (key || 'local');
}

function nonEmpty(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

/** `YYYYMMDD` (longer timestamps are cut to the date) → `YYYY-MM-DD`, or null. */
export function parseHl7Date(raw: string): string | null {
	const match = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
	if (!match) {
		return null;
	}
	const [, year, month, day] = match;
	const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
	return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(day) ? null : `${year}-${month}-${day}`;
}

/** HL7 TS/DTM `YYYY[MM[DD[HH[MM[SS[.S+]]]]]][+/-ZZZZ]` → Date, or null. */
export function parseHl7Timestamp(raw: string, defaultOffset = '+0800'): Date | null {
	const match = /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:\.(\d{1,4}))?([+-]\d{4})?$/.exec(raw.trim());
	if (!match) {
		return null;
	}
	const [, year, month = '01', day = '01', hour = '00', minute = '00', second = '00', fraction = '', zone] = match;
	const offset = zone ?? defaultOffset;
	const millis = fraction ? `.${fraction.padEnd(3, '0').slice(0, 3)}` : '';
	const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${millis}${offset.slice(0, 3)}:${offset.slice(3)}`;
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? null : date;
}
