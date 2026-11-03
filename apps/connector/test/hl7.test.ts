import { describe, expect, it } from 'vitest';

import { buildAck, escapeText, normalizeSegments, parseAck, parseMsh, senderKey } from '../src/hl7.ts';
import { syntheticOru } from './helpers.ts';

const NOW = new Date(Date.UTC(2026, 10, 3, 8, 30, 5));

describe('parseMsh', () => {
	it('reads the routing fields', () => {
		const header = parseMsh(syntheticOru('ABC123'));
		expect(header).toMatchObject({
			sendingApplication: 'LIS',
			sendingFacility: 'BOHOL_LAB',
			receivingApplication: 'LOOPWISE',
			receivingFacility: 'HUB',
			messageType: 'ORU^R01^ORU_R01',
			controlId: 'ABC123',
			processingId: 'P',
			version: '2.5.1',
		});
		expect(senderKey(header!)).toBe('LIS|BOHOL_LAB');
	});

	it('returns null for text that is not HL7', () => {
		expect(parseMsh('hello')).toBeNull();
		expect(parseMsh('PID|1||X')).toBeNull();
		// MSH without MSH-10 cannot be acknowledged or deduplicated.
		expect(parseMsh('MSH|^~\\&|LIS|LAB|||20261103||ORU^R01||P|2.5.1')).toBeNull();
	});

	it('folds LF and CRLF segment endings into CR', () => {
		expect(normalizeSegments('MSH|a\r\nPID|b\nOBX|c\r\n')).toBe('MSH|a\rPID|b\rOBX|c');
	});
});

describe('buildAck', () => {
	it('answers a message with sender and receiver swapped and MSA-2 = its MSH-10', () => {
		const ack = buildAck(parseMsh(syntheticOru('ABC123')), 'AA', { controlId: 'ACK1', now: NOW });
		expect(ack).toBe(
			'MSH|^~\\&|LOOPWISE|HUB|LIS|BOHOL_LAB|20261103083005+0000||ACK^R01^ACK|ACK1|P|2.5.1\rMSA|AA|ABC123',
		);
		expect(parseAck(ack)).toEqual({ code: 'AA', controlId: 'ABC123', text: '' });
	});

	it('escapes MSA-3 text', () => {
		const ack = buildAck(parseMsh(syntheticOru('X1')), 'AE', { text: 'bad | field ^ here', now: NOW });
		expect(ack.split('\r')[1]).toBe('MSA|AE|X1|bad \\F\\ field \\S\\ here');
	});

	it('still builds a valid AR when there is no header to answer', () => {
		const ack = buildAck(null, 'AR', {
			text: 'Not HL7',
			fallback: { application: 'LOOPWISE_CONNECTOR', facility: 'TAG_HC' },
			controlId: 'ACK2',
			now: NOW,
		});
		expect(ack).toBe(
			'MSH|^~\\&|LOOPWISE_CONNECTOR|TAG_HC|||20261103083005+0000||ACK|ACK2|P|2.5.1\rMSA|AR||Not HL7',
		);
		expect(parseAck(ack)?.code).toBe('AR');
	});

	it('uses a random 20-character control id by default', () => {
		const ack = buildAck(parseMsh(syntheticOru()), 'AA');
		expect(parseMsh(ack)?.controlId).toMatch(/^[0-9a-f]{20}$/);
	});
});

describe('parseAck', () => {
	it('reads enhanced-mode commit codes as their original-mode equivalents', () => {
		expect(parseAck('MSH|^~\\&|A|B|C|D|1||ACK|1|P|2.5.1\rMSA|CA|X')?.code).toBe('AA');
		expect(parseAck('MSH|^~\\&|A|B|C|D|1||ACK|1|P|2.5.1\rMSA|CR|X')?.code).toBe('AR');
	});

	it('returns null without a usable MSA', () => {
		expect(parseAck('MSH|^~\\&|A|B|C|D|1||ACK|1|P|2.5.1')).toBeNull();
		expect(parseAck('MSH|^~\\&|A|B|C|D|1||ACK|1|P|2.5.1\rMSA|ZZ|X')).toBeNull();
		expect(parseAck('<html>502</html>')).toBeNull();
	});
});

describe('escapeText', () => {
	it('escapes every delimiter and flattens line breaks', () => {
		expect(escapeText('a\\b|c^d~e&f\ng')).toBe('a\\E\\b\\F\\c\\S\\d\\R\\e\\T\\f g');
	});
});
