import { describe, expect, it } from 'vitest';

import {
	buildOrmO01,
	escapeHl7,
	hl7ControlId,
	hl7Date,
	hl7DateTime,
	MAX_CONTROL_ID_LENGTH,
	type OrmInput,
} from './orm-message.js';

const input = (overrides: Partial<OrmInput> = {}): OrmInput => ({
	controlId: 'ORM-1',
	at: new Date('2026-11-06T01:30:00Z'),
	orderControl: 'NW',
	sending: { slug: 'tagbilaran-hc', name: 'Tagbilaran City Health Center' },
	receiving: { slug: 'bohol-diagnostics', name: 'Bohol Diagnostics' },
	patient: {
		id: 'pat-1',
		familyName: 'Santos',
		givenName: 'Maria',
		birthDate: new Date('1981-03-14T00:00:00Z'),
		sex: 'female',
		phone: '+639171234567',
		identifiers: [
			{ system: 'MRN', value: 'HC-0001', facilitySlug: 'tagbilaran-hc' },
			{ system: 'PhilHealth', value: '12-345678901-2', facilitySlug: 'tagbilaran-hc' },
			{ system: 'MRN', value: 'BD-77', facilitySlug: 'bohol-diagnostics' },
		],
	},
	order: {
		id: 'ord-1',
		code: '4548-4',
		codeSystem: 'LOINC',
		display: 'Hemoglobin A1c',
		priority: 'routine',
		notes: null,
		createdAt: new Date('2026-11-06T01:29:00Z'),
	},
	orderingProvider: { id: 'doc-1', name: 'Ana Reyes' },
	...overrides,
});

const segments = (message: string) => message.split('\r').map((line) => line.split('|'));
const segmentOf = (message: string, name: string) => segments(message).find((fields) => fields[0] === name);

describe('ORM^O01 builder', () => {
	it('builds MSH, PID, PV1, ORC and OBR separated by carriage returns', () => {
		const message = buildOrmO01(input());
		expect(segments(message).map((fields) => fields[0])).toEqual(['MSH', 'PID', 'PV1', 'ORC', 'OBR']);
		expect(message).not.toContain('\n');
		expect(message.split('\r')[0]).toBe(
			'MSH|^~\\&|LOOPWISE|tagbilaran-hc||bohol-diagnostics|20261106093000+0800||ORM^O01|ORM-1|P|2.3.1',
		);
	});

	it('lists the receiving facility identifier first, then MRN, PhilHealth and the hub id (PID-3)', () => {
		const pid = segmentOf(buildOrmO01(input()), 'PID')!;
		expect(pid[3].split('~')).toEqual([
			'BD-77^^^bohol-diagnostics^MR',
			'HC-0001^^^tagbilaran-hc^MR',
			'12-345678901-2^^^PHILHEALTH^NH',
			'pat-1^^^LOOPWISE^PI',
		]);
		expect(pid[5]).toBe('Santos^Maria');
		expect(pid[7]).toBe('19810314');
		expect(pid[8]).toBe('F');
		expect(pid[13]).toBe('+639171234567');
	});

	it('places a new order with the order id as placer number and the LOINC code', () => {
		const message = buildOrmO01(input({ order: { ...input().order, priority: 'stat' } }));
		const orc = segmentOf(message, 'ORC')!;
		expect(orc[1]).toBe('NW');
		expect(orc[2]).toBe('ord-1^LOOPWISE');
		expect(orc[7]).toBe('^^^^^S');
		expect(orc[12]).toBe('doc-1^Ana Reyes');
		expect(orc[21]).toBe('Tagbilaran City Health Center');
		const obr = segmentOf(message, 'OBR')!;
		expect(obr[2]).toBe('ord-1^LOOPWISE');
		expect(obr[4]).toBe('4548-4^Hemoglobin A1c^LN');
		expect(obr[5]).toBe('S');
		expect(obr[16]).toBe('doc-1^Ana Reyes');
	});

	it('cancels with ORC-1 CA and marks a local code as L', () => {
		const message = buildOrmO01(
			input({ orderControl: 'CA', order: { ...input().order, codeSystem: 'LOCAL', code: 'X-1' } }),
		);
		expect(segmentOf(message, 'ORC')![1]).toBe('CA');
		expect(segmentOf(message, 'OBR')![4]).toBe('X-1^Hemoglobin A1c^L');
	});

	it('escapes delimiters in every free-text value and adds notes as NTE', () => {
		const message = buildOrmO01(
			input({
				patient: { ...input().patient, familyName: 'Dela Cruz|Jr', givenName: 'Ma^ria', identifiers: [] },
				order: { ...input().order, notes: 'Fasting 8h & bring\r\nprior results ~ \\ thanks' },
			}),
		);
		const pid = segmentOf(message, 'PID')!;
		expect(pid[5]).toBe('Dela Cruz\\F\\Jr^Ma\\S\\ria');
		expect(pid[3]).toBe('pat-1^^^LOOPWISE^PI');
		expect(message.split('\r')).toHaveLength(6);
		expect(segmentOf(message, 'NTE')).toEqual([
			'NTE',
			'1',
			'P',
			'Fasting 8h \\T\\ bring\\X0D0A\\prior results \\R\\ \\E\\ thanks',
		]);
	});

	it('escapes the backslash before the other delimiters', () => {
		expect(escapeHl7('a\\|b')).toBe('a\\E\\\\F\\b');
		expect(escapeHl7('plain')).toBe('plain');
	});

	it('formats times in Philippine time and dates as YYYYMMDD', () => {
		expect(hl7DateTime(new Date('2026-11-06T20:05:09Z'))).toBe('20261107040509+0800');
		expect(hl7Date(new Date('1981-03-14T00:00:00Z'))).toBe('19810314');
	});

	it('makes MSH-10 control ids of at most 20 characters that do not repeat', () => {
		const ids = new Set(Array.from({ length: 2000 }, () => hl7ControlId()));
		expect(ids.size).toBe(2000);
		for (const id of ids) {
			expect(id).toMatch(/^LW[0-9A-Z]{18}$/);
			expect(id.length).toBeLessThanOrEqual(MAX_CONTROL_ID_LENGTH);
		}
		const fixed = hl7ControlId(new Date('2026-11-06T01:30:00Z'), (size) => new Uint8Array(size));
		expect(fixed).toBe(`LW${new Date('2026-11-06T01:30:00Z').getTime().toString(36).toUpperCase()}0000000000`);
		const message = buildOrmO01(input({ controlId: hl7ControlId() }));
		expect(message.split('\r')[0].split('|')[9].length).toBeLessThanOrEqual(20);
	});

	it('refuses a control id longer than MSH-10 allows', () => {
		expect(() => buildOrmO01(input({ controlId: 'x'.repeat(21) }))).toThrow(/MSH-10/);
		expect(() => buildOrmO01(input({ controlId: '' }))).toThrow(/MSH-10/);
	});
});
