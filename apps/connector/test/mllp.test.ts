import { describe, expect, it } from 'vitest';

import { CARRIAGE_RETURN, END_BLOCK, frame, MllpDecoder, MllpFrameTooLargeError, START_BLOCK } from '../src/mllp.ts';
import { syntheticOru } from './helpers.ts';

describe('MllpDecoder', () => {
	it('reads one framed message', () => {
		const decoder = new MllpDecoder();
		expect(decoder.push(frame('MSH|a'))).toEqual(['MSH|a']);
		expect(decoder.pendingBytes).toBe(0);
	});

	it('joins a frame split across reads, byte by byte', () => {
		const message = syntheticOru();
		const bytes = frame(message);
		const decoder = new MllpDecoder();
		const out: string[] = [];
		for (const byte of bytes) {
			out.push(...decoder.push(Buffer.from([byte])));
		}
		expect(out).toEqual([message]);
	});

	it('waits for the CR after FS before emitting', () => {
		const bytes = frame('MSH|x');
		const decoder = new MllpDecoder();
		expect(decoder.push(bytes.subarray(0, bytes.length - 1))).toEqual([]);
		expect(decoder.push(bytes.subarray(bytes.length - 1))).toEqual(['MSH|x']);
	});

	it('splits several frames that arrive in one read', () => {
		const decoder = new MllpDecoder();
		const joined = Buffer.concat([frame('MSH|1'), frame('MSH|2'), frame('MSH|3').subarray(0, 4)]);
		expect(decoder.push(joined)).toEqual(['MSH|1', 'MSH|2']);
		expect(decoder.push(frame('MSH|3').subarray(4))).toEqual(['MSH|3']);
	});

	it('drops bytes outside a frame', () => {
		const decoder = new MllpDecoder();
		const noisy = Buffer.concat([Buffer.from('\r\nnoise'), frame('MSH|1'), Buffer.from('\n')]);
		expect(decoder.push(noisy)).toEqual(['MSH|1']);
		expect(decoder.pendingBytes).toBe(0);
	});

	it('accepts an FS not followed by CR', () => {
		const decoder = new MllpDecoder();
		const bytes = Buffer.from([START_BLOCK, ...Buffer.from('MSH|1'), END_BLOCK, START_BLOCK]);
		expect(decoder.push(bytes)).toEqual(['MSH|1']);
		expect(decoder.push(Buffer.from([...Buffer.from('MSH|2'), END_BLOCK, CARRIAGE_RETURN]))).toEqual(['MSH|2']);
	});

	it('keeps multi-byte UTF-8 characters split across reads', () => {
		const bytes = frame('MSH|Ñoño');
		const decoder = new MllpDecoder();
		const cut = bytes.indexOf(0xc3) + 1;
		expect(decoder.push(bytes.subarray(0, cut))).toEqual([]);
		expect(decoder.push(bytes.subarray(cut))).toEqual(['MSH|Ñoño']);
	});

	it('throws on a frame larger than the limit', () => {
		const decoder = new MllpDecoder(16);
		expect(() => decoder.push(Buffer.concat([Buffer.from([START_BLOCK]), Buffer.alloc(32, 65)]))).toThrow(
			MllpFrameTooLargeError,
		);
	});
});
