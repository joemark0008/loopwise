import net from 'node:net';

import { buildAck, normalizeSegments, parseMsh, senderKey } from './hl7.ts';
import { errorText, type Logger } from './logger.ts';
import { frame, MllpDecoder } from './mllp.ts';
import type { InboundMessage, MessageQueue } from './queue.ts';

export interface MllpServerOptions {
	queue: MessageQueue;
	logger: Logger;
	/** Who the connector says it is when it rejects text that has no MSH to answer. */
	identity: { application: string; facility: string };
	/** Called after each message is safely queued (wakes the forwarder). */
	onQueued?: (message: InboundMessage) => void;
	/** Idle connections are closed after this long. */
	idleTimeoutMs?: number;
	maxFrameBytes?: number;
}

export interface MllpServer {
	server: net.Server;
	listen(port: number, host?: string): Promise<number>;
	/** Stops accepting, lets open connections finish their current message, then closes them. */
	close(graceMs?: number): Promise<void>;
}

/**
 * The LIS-facing MLLP listener. Each message is committed to the local queue *before* the LIS gets AA (a commit
 * ACK): the connector, not the hub, takes custody, so the LIS can move on while the hub is unreachable (DESIGN.md
 * §6.3). Text with no MSH gets AR (resending it will never help); a failed write to the queue gets AE, so the LIS
 * keeps the message and resends it.
 */
export function createMllpServer(options: MllpServerOptions): MllpServer {
	const { queue, logger, identity } = options;
	const sockets = new Set<net.Socket>();

	const handle = (raw: string): string => {
		const body = normalizeSegments(raw);
		const header = parseMsh(body);
		if (!header) {
			logger.warn('mllp.rejected', { reason: 'no MSH segment or MSH-10', bytes: Buffer.byteLength(raw) });
			return buildAck(null, 'AR', {
				text: 'Not an HL7 v2 message (no MSH segment or MSH-10)',
				fallback: identity,
			});
		}
		try {
			const message = queue.enqueue({
				controlId: header.controlId,
				sender: senderKey(header),
				messageType: header.messageType,
				body,
			});
			logger.info('message.queued', {
				id: message.id,
				controlId: header.controlId,
				messageType: header.messageType,
			});
			options.onQueued?.(message);
			return buildAck(header, 'AA');
		} catch (error) {
			logger.error('message.queue_failed', { controlId: header.controlId, error: errorText(error) });
			return buildAck(header, 'AE', { text: 'Connector could not store the message; resend it' });
		}
	};

	const server = net.createServer((socket) => {
		sockets.add(socket);
		const decoder = new MllpDecoder(options.maxFrameBytes);
		const peer = `${socket.remoteAddress ?? '?'}:${socket.remotePort ?? '?'}`;
		logger.debug('mllp.connected', { peer });
		socket.setTimeout(options.idleTimeoutMs ?? 5 * 60_000, () => socket.end());
		socket.on('data', (chunk) => {
			let messages: string[];
			try {
				messages = decoder.push(chunk);
			} catch (error) {
				logger.warn('mllp.frame_error', { peer, error: errorText(error) });
				socket.destroy();
				return;
			}
			for (const message of messages) {
				socket.write(frame(handle(message)));
			}
		});
		socket.on('error', (error) => logger.debug('mllp.socket_error', { peer, error: errorText(error) }));
		socket.on('close', () => {
			sockets.delete(socket);
			logger.debug('mllp.disconnected', { peer });
		});
	});

	return {
		server,
		listen(port, host = '0.0.0.0') {
			return new Promise((resolve, reject) => {
				server.once('error', reject);
				server.listen(port, host, () => {
					server.off('error', reject);
					resolve((server.address() as net.AddressInfo).port);
				});
			});
		},
		async close(graceMs = 5_000) {
			const closed = new Promise<void>((resolve) => server.close(() => resolve()));
			// Messages are handled synchronously as they arrive, so ending a socket never loses an accepted message.
			for (const socket of sockets) {
				socket.end();
			}
			const timer = setTimeout(() => {
				for (const socket of sockets) {
					socket.destroy();
				}
			}, graceMs);
			await closed;
			clearTimeout(timer);
		},
	};
}
