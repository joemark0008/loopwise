import { describe, expect, it } from 'vitest';

import { buildAck } from './hl7-ack.js';
import { component, escapeHl7, field, findSegment, Hl7ParseError, parseHl7, repetitions } from './hl7-parser.js';
import { sampleOru } from './oru-samples.js';

describe('parseHl7', () => {
	it('splits segments, fields, components and repetitions with spec positions', () => {
		const message = parseHl7(sampleOru());
		expect(message.segments.map((s) => s.name)).toEqual(['MSH', 'PID', 'ORC', 'OBR', 'OBX']);
		const msh = findSegment(message, 'MSH');
		expect(field(msh, 1)).toBe('|');
		expect(field(msh, 2)).toBe('^~\\&');
		expect(field(msh, 3)).toBe('BDL-LIS');
		expect(component(msh, 9, 2)).toBe('R01');
		expect(field(msh, 10)).toBe('BDL-0001');
		const pid = findSegment(message, 'PID');
		expect(repetitions(pid, 3)).toHaveLength(2);
		expect(component(pid, 3, 4, 1)).toBe('PhilHealth');
		expect(component(pid, 5, 2)).toBe('Maria');
		expect(field(pid, 99)).toBe('');
	});

	it('accepts LF and CRLF separators and a leading BOM', () => {
		const message = parseHl7(`\uFEFF${sampleOru().split('\r').join('\r\n')}\n`);
		expect(message.segments).toHaveLength(5);
	});

	it('honours custom delimiters', () => {
		const message = parseHl7('MSH#*!%$#A#B\rPID#1##123*X*Y*AUTH!456');
		const pid = findSegment(message, 'PID');
		expect(component(pid, 3, 4)).toBe('AUTH');
		expect(component(pid, 3, 1, 1)).toBe('456');
	});

	it('resolves escape sequences', () => {
		const message = parseHl7(
			'MSH|^~\\&|A\rOBX|1|TX|X||a\\F\\b\\S\\c\\T\\d\\R\\e\\E\\f\\.br\\g\\X4142\\h\\H\\i\\N\\',
		);
		expect(field(findSegment(message, 'OBX'), 5)).toBe('a|b^c&d~e\\f\ngABhi');
	});

	it('round-trips escapeHl7', () => {
		const text = 'K+ 6.5 | H^igh & ~ \\ odd\nline';
		const message = parseHl7(`MSH|^~\\&|A\rNTE|1||${escapeHl7(text, parseHl7('MSH|^~\\&|A').delimiters)}`);
		expect(field(findSegment(message, 'NTE'), 3)).toBe(text);
	});

	it.each([
		['', 'MSH'],
		['PID|1', 'MSH'],
		['MSH|^~', 'MSH'],
		['MSH|^^\\&|A', 'delimiters'],
		['MSH|^~\\&|A\rbad|1', 'segment'],
	])('rejects %j', (raw, message) => {
		expect(() => parseHl7(raw)).toThrow(Hl7ParseError);
		expect(() => parseHl7(raw)).toThrow(new RegExp(message, 'i'));
	});
});

describe('buildAck', () => {
	const now = new Date('2026-11-06T01:30:00Z');

	it('answers AA with the original control id, addressed back to the sender', () => {
		const ack = buildAck({ code: 'AA', controlId: 'BDL-0001', original: parseHl7(sampleOru()), now });
		const parsed = parseHl7(ack);
		const msh = findSegment(parsed, 'MSH');
		expect(field(msh, 5)).toBe('BDL-LIS');
		expect(field(msh, 6)).toBe('BOHOL-DIAGNOSTICS');
		expect(field(msh, 7)).toBe('20261106093000+0800');
		expect(component(msh, 9, 1)).toBe('ACK');
		expect(component(msh, 9, 2)).toBe('R01');
		expect(field(msh, 12)).toBe('2.5.1');
		expect(field(findSegment(parsed, 'MSA'), 1)).toBe('AA');
		expect(field(findSegment(parsed, 'MSA'), 2)).toBe('BDL-0001');
		expect(findSegment(parsed, 'ERR')).toBeUndefined();
	});

	it('adds an ERR with the escaped reason for AE and AR', () => {
		const ack = buildAck({ code: 'AE', controlId: 'X|1', text: 'No patient | found', now });
		const parsed = parseHl7(ack);
		expect(field(findSegment(parsed, 'MSA'), 2)).toBe('X|1');
		expect(field(findSegment(parsed, 'MSA'), 3)).toBe('No patient | found');
		expect(field(findSegment(parsed, 'ERR'), 8)).toBe('No patient | found');
		expect(ack.split('\r')).toHaveLength(3);
	});
});
