import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { buildAck, parseMsh } from '../src/hl7.ts';
import { frame, MllpDecoder } from '../src/mllp.ts';

/** A synthetic ORU^R01 (HbA1c). Never real patient data. */
export function syntheticOru(controlId = 'CTRL0001', sender = 'LIS'): string {
	return [
		`MSH|^~\\&|${sender}|BOHOL_LAB|LOOPWISE|HUB|20261103080000||ORU^R01^ORU_R01|${controlId}|P|2.5.1`,
		'PID|1||SYN-0001^^^BOHOL_LAB^MR||Testcase^Synthetic||19800101|F',
		'OBR|1|ORD-1|LAB-1|4548-4^Hemoglobin A1c^LN|||20261103070000',
		'OBX|1|NM|4548-4^Hemoglobin A1c^LN||8.2|%|4.0-5.6|H|||F',
	].join('\r');
}

export function tempQueuePath(): { file: string; cleanup: () => void } {
	const dir = mkdtempSync(path.join(os.tmpdir(), 'loopwise-connector-'));
	return { file: path.join(dir, 'queue.db'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export interface HubRequest {
	method: string;
	url: string;
	authorization: string | undefined;
	contentType: string | undefined;
	body: string;
}

export type HubResponder = (request: HubRequest) => { status: number; body?: string; contentType?: string };

/** An HTTP server standing in for the hub. Responses come from `respond`, which tests swap freely. */
export async function startFakeHub(respond: HubResponder) {
	const requests: HubRequest[] = [];
	const hub = {
		requests,
		respond,
		url: '',
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
	};
	const server = http.createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk) => chunks.push(chunk));
		req.on('end', () => {
			const request: HubRequest = {
				method: req.method ?? '',
				url: req.url ?? '',
				authorization: req.headers.authorization,
				contentType: req.headers['content-type'],
				body: Buffer.concat(chunks).toString('utf8'),
			};
			requests.push(request);
			const reply = hub.respond(request);
			res.writeHead(reply.status, { 'content-type': reply.contentType ?? 'text/plain' });
			res.end(reply.body ?? '');
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
	hub.url = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
	server.closeIdleConnections();
	return hub;
}

/** A hub ACK for an inbound message, as the hub would answer it. */
export function hubAck(message: string, code: 'AA' | 'AE' | 'AR'): string {
	return buildAck(parseMsh(message), code);
}

/** An MLLP server standing in for a facility LIS: records what it receives and answers each message with `code`. */
export async function startFakeLis(code: 'AA' | 'AE' | 'AR' = 'AA') {
	const received: string[] = [];
	const sockets = new Set<net.Socket>();
	const server = net.createServer((socket) => {
		sockets.add(socket);
		socket.on('close', () => sockets.delete(socket));
		const decoder = new MllpDecoder();
		socket.on('data', (chunk) => {
			for (const message of decoder.push(chunk)) {
				received.push(message);
				socket.write(frame(buildAck(parseMsh(message), code)));
			}
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
	return {
		received,
		port: (server.address() as net.AddressInfo).port,
		close: () =>
			new Promise<void>((resolve) => {
				for (const socket of sockets) {
					socket.destroy();
				}
				server.close(() => resolve());
			}),
	};
}

export async function waitFor(condition: () => boolean, timeoutMs = 5_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error('condition not met in time');
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}
