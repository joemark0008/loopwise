import { describe, expect, it } from 'vitest';

import { parseHl7 } from './hl7-parser.js';
import { mapOru, OruMappingError, parseHl7Date, parseHl7Timestamp } from './oru-mapper.js';
import { sampleOru, sampleRadiologyOru } from './oru-samples.js';

const map = (raw: string) => mapOru(parseHl7(raw));

describe('mapOru', () => {
	it("maps Maria's HbA1c", () => {
		const oru = map(sampleOru({ placerOrderNumber: 'order-123' }));
		expect(oru).toMatchObject({
			controlId: 'BDL-0001',
			messageType: 'ORU^R01',
			sendingApplication: 'BDL-LIS',
			sendingFacility: 'BOHOL-DIAGNOSTICS',
			patient: {
				identifiers: [
					{ value: 'THC-0001', assigningAuthority: 'THC', typeCode: 'MR' },
					{ value: 'SYN-0000-0001', assigningAuthority: 'PhilHealth', typeCode: 'NH' },
				],
				familyName: 'Santos',
				givenName: 'Maria',
				birthDate: '1981-04-12',
				sex: 'female',
			},
		});
		expect(oru.orders).toHaveLength(1);
		const [order] = oru.orders;
		expect(order).toMatchObject({
			placerOrderNumber: 'order-123',
			fillerOrderNumber: 'BDL-ACC-7781',
			code: '4548-4',
			codeSystem: 'LOINC',
			display: 'Hemoglobin A1c',
		});
		expect(order.resultedAt?.toISOString()).toBe('2026-11-06T01:25:00.000Z');
		expect(order.observations).toEqual([
			{
				setId: '4548-4:',
				valueType: 'NM',
				code: '4548-4',
				codeSystem: 'LOINC',
				display: 'Hemoglobin A1c',
				value: '7.2',
				valueNumeric: 7.2,
				unit: '%',
				referenceRange: '4.0-5.6',
				flag: 'high',
				status: 'F',
				observedAt: new Date('2026-11-06T01:20:00.000Z'),
			},
		]);
	});

	it('takes the placer number from ORC-2 when OBR-2 is empty', () => {
		const raw = sampleOru({ placerOrderNumber: 'order-9' }).replace('OBR|1|order-9|', 'OBR|1||');
		expect(map(raw).orders[0].placerOrderNumber).toBe('order-9');
	});

	it.each([
		['N', 'normal'],
		['L', 'low'],
		['H', 'high'],
		['A', 'abnormal'],
		['AA', 'abnormal'],
		['LL', 'critical_low'],
		['HH', 'critical_high'],
		['', null],
		['>', null],
	])('maps OBX-8 %j to %s', (flag, expected) => {
		expect(map(sampleOru({ flag })).orders[0].observations[0].flag).toBe(expected);
	});

	it('joins a radiology report sent as TX lines into one observation', () => {
		const oru = map(sampleRadiologyOru());
		expect(oru.orders[0].observations).toHaveLength(1);
		expect(oru.orders[0].observations[0]).toMatchObject({
			valueType: 'TX',
			code: '36643-5',
			value: 'FINDINGS: Clear lungs.\nIMPRESSION: No acute disease & normal heart size.',
			valueNumeric: null,
		});
		// No timezone in the message: Philippine time is assumed.
		expect(oru.orders[0].resultedAt?.toISOString()).toBe('2026-11-06T02:00:00.000Z');
	});

	it('accepts ST values and skips deleted observations', () => {
		const raw = sampleOru()
			.replace('OBX|1|NM|4548-4^Hemoglobin A1c^LN||7.2|', 'OBX|1|ST|BIRADS^BI-RADS^L||4|')
			.concat('\rOBX|2|NM|1558-6^Glucose^LN||99|mg/dL|70-99|N|||D');
		const [observation, ...rest] = map(raw).orders[0].observations;
		expect(observation).toMatchObject({ valueType: 'ST', value: '4', valueNumeric: null, codeSystem: 'local' });
		expect(rest).toEqual([]);
	});

	it.each([
		['an ADT message', sampleOru().replace('ORU^R01^ORU_R01', 'ADT^A01'), /Unsupported message type ADT\^A01/],
		['an empty MSH-10', sampleOru({ controlId: '' }), /MSH-10/],
		['no PID', sampleOru().replace(/\rPID[^\r]*/, ''), /PID/],
		['no OBX', sampleOru().replace(/\rOBX[^\r]*/, ''), /no OBX/],
		['an OBX before OBR', sampleOru().replace(/\rORC[^\r]*\rOBR[^\r]*/, ''), /before any OBR/],
		['a CE value', sampleOru().replace('|NM|', '|CE|'), /CE is not supported/],
		['a non-numeric NM', sampleOru({ value: 'seven' }), /not a number/],
	])('rejects %s', (_label, raw, message) => {
		expect(() => map(raw)).toThrow(OruMappingError);
		expect(() => map(raw)).toThrow(message);
	});
});

describe('HL7 dates', () => {
	it('parses DTM with and without an offset', () => {
		expect(parseHl7Timestamp('20261106093000+0800')?.toISOString()).toBe('2026-11-06T01:30:00.000Z');
		expect(parseHl7Timestamp('20261106093000.5-0500')?.toISOString()).toBe('2026-11-06T14:30:00.500Z');
		expect(parseHl7Timestamp('202611060930')?.toISOString()).toBe('2026-11-06T01:30:00.000Z');
		expect(parseHl7Timestamp('20261106', '+0000')?.toISOString()).toBe('2026-11-06T00:00:00.000Z');
		expect(parseHl7Timestamp('garbage')).toBeNull();
		expect(parseHl7Timestamp('')).toBeNull();
	});

	it('parses dates of birth', () => {
		expect(parseHl7Date('19810412')).toBe('1981-04-12');
		expect(parseHl7Date('198104121200')).toBe('1981-04-12');
		expect(parseHl7Date('19810231')).toBeNull();
		expect(parseHl7Date('')).toBeNull();
	});
});
