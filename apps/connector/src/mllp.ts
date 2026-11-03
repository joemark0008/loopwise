import net from 'node:net';

/** MLLP framing (HL7 v2 Appendix C): `<VT> message <FS><CR>`. */
export const START_BLOCK = 0x0b;
export const END_BLOCK = 0x1c;
export const CARRIAGE_RETURN = 0x0d;

/** A frame larger than this drops the connection: no LIS message is anywhere near it. */
export const DEFAULT_MAX_FRAME_BYTES = 10 * 1024 * 1024;

export function frame(message: string): Buffer {
	return Buffer.concat([
		Buffer.from([START_BLOCK]),
		Buffer.from(message, 'utf8'),
		Buffer.from([END_BLOCK, CARRIAGE_RETURN]),
	]);
}

export class MllpFrameTooLargeError extends Error {
	constructor(bytes: number) {
		super(`MLLP frame exceeds ${bytes} bytes`);
		this.name = 'MllpFrameTooLargeError';
	}
}

/**
 * Turns a TCP byte stream into MLLP payloads. TCP may split a frame across reads or join several frames into one, so
 * bytes are buffered until `<FS><CR>`. Bytes outside a frame (line noise, keep-alives) are dropped.
 */
export class MllpDecoder {
	private buffer: Buffer = Buffer.alloc(0);
	private readonly maxFrameBytes: number;

	constructor(maxFrameBytes = DEFAULT_MAX_FRAME_BYTES) {
		this.maxFrameBytes = maxFrameBytes;
	}

	push(chunk: Buffer): string[] {
		this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
		const messages: string[] = [];
		for (;;) {
			const start = this.buffer.indexOf(START_BLOCK);
			if (start === -1) {
				this.buffer = Buffer.alloc(0);
				break;
			}
			if (start > 0) {
				this.buffer = this.buffer.subarray(start);
			}
			const end = this.buffer.indexOf(END_BLOCK, 1);
			if (end === -1) {
				if (this.buffer.length > this.maxFrameBytes) {
					this.buffer = Buffer.alloc(0);
					throw new MllpFrameTooLargeError(this.maxFrameBytes);
				}
				break;
			}
			if (end + 1 === this.buffer.length) {
				// FS arrived, CR not yet: wait for it rather than guess.
				break;
			}
			messages.push(this.buffer.subarray(1, end).toString('utf8'));
			// Lenient: an FS not followed by CR still ends the frame.
			this.buffer = this.buffer.subarray(this.buffer[end + 1] === CARRIAGE_RETURN ? end + 2 : end + 1);
		}
		return messages;
	}

	/** Bytes of an unfinished frame still waiting for its end. */
	get pendingBytes(): number {
		return this.buffer.length;
	}
}

export interface MllpSendOptions {
	host: string;
	port: number;
	timeoutMs: number;
}

/** Sends one framed message and resolves with the first framed reply (the ACK). */
export function mllpSend(message: string, options: MllpSendOptions): Promise<string> {
	return new Promise((resolve, reject) => {
		const decoder = new MllpDecoder();
		let settled = false;
		const socket = net.createConnection({ host: options.host, port: options.port });
		const finish = (error: Error | null, ack?: string) => {
			if (settled) {
				return;
			}
			settled = true;
			socket.destroy();
			if (error) {
				reject(error);
			} else {
				resolve(ack ?? '');
			}
		};
		socket.setTimeout(options.timeoutMs, () => finish(new Error(`no ACK within ${options.timeoutMs} ms`)));
		socket.on('connect', () => socket.write(frame(message)));
		socket.on('data', (chunk) => {
			try {
				const [ack] = decoder.push(chunk);
				if (ack !== undefined) {
					finish(null, ack);
				}
			} catch (error) {
				finish(error as Error);
			}
		});
		socket.on('error', (error) => finish(error));
		socket.on('close', () => finish(new Error('connection closed before an ACK')));
	});
}
