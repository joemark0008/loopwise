import { Injectable, Logger } from '@nestjs/common';

import { ClinicalEventsService } from '../clinical/events/clinical-events.service.js';
import { OrderService } from '../clinical/orders/order.service.js';
import { ResultIngestService } from '../clinical/results/result-ingest.service.js';
import { ClinicalDbService } from '../clinical/rls/clinical-db.service.js';
import { HandlerError } from '../common/errors/handler-error.js';
import type { Hl7MessageStatus, Organization } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { type AckCode, buildAck } from './hl7-ack.js';
import { Hl7MessageRepository } from './hl7-message.repository.js';
import { type Hl7Message as ParsedMessage, Hl7ParseError, parseHl7 } from './hl7-parser.js';
import { isOrderStatusMessage, mapOrderStatus, type NormalizedOrderStatus } from './orm-mapper.js';
import { controlIdOf, mapOru, messageTypeOf, OruMappingError } from './oru-mapper.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Raw messages larger than this are rejected (AR) rather than stored. */
export const MAX_HL7_MESSAGE_BYTES = 1_000_000;

const STATUS_BY_ACK: Record<AckCode, Hl7MessageStatus> = { AA: 'accepted', AE: 'error', AR: 'rejected' };

/**
 * The HL7 v2 ingest (DESIGN.md §4.3 step 2, §9): parse, answer resends from the log, store the results in one
 * system transaction with the log row, then publish `result.received`. Always answers an ACK; only transient failures
 * (the database is down) throw, so the connector retries them.
 */
@Injectable()
export class Hl7IngestService {
	private readonly logger = new Logger(Hl7IngestService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly messages: Hl7MessageRepository,
		private readonly results: ResultIngestService,
		private readonly events: ClinicalEventsService,
		private readonly orders: OrderService,
	) {}

	async receive(facility: Organization, raw: string): Promise<string> {
		let parsed: ParsedMessage;
		try {
			if (!raw.trim()) {
				throw new Hl7ParseError('The body is empty');
			}
			if (Buffer.byteLength(raw, 'utf8') > MAX_HL7_MESSAGE_BYTES) {
				throw new Hl7ParseError('The message is too large');
			}
			parsed = parseHl7(raw);
		} catch (error) {
			if (!(error instanceof Hl7ParseError)) {
				throw error;
			}
			const ack = buildAck({ code: 'AR', controlId: '', text: error.message });
			// No control id to deduplicate on: logged as its own row.
			await this.messages.create({
				orgId: facility.id,
				raw: raw.slice(0, MAX_HL7_MESSAGE_BYTES),
				status: 'rejected',
				ackCode: 'AR',
				ack,
				error: error.message,
			});
			return ack;
		}

		const controlId = controlIdOf(parsed);
		if (controlId) {
			const previous = await this.messages.findByControlId(facility.id, controlId);
			if (previous) {
				return previous.ack;
			}
		}

		try {
			return await this.process(facility, raw, parsed, controlId);
		} catch (error) {
			// Two deliveries of the same message raced: the other one is stored, answer with its ACK.
			if (controlId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				const previous = await this.messages.findByControlId(facility.id, controlId);
				if (previous) {
					return previous.ack;
				}
			}
			throw error;
		}
	}

	private async process(
		facility: Organization,
		raw: string,
		parsed: ParsedMessage,
		controlId: string,
	): Promise<string> {
		const messageType = messageTypeOf(parsed) || null;
		const outcome = await this.db.asSystem(async (tx) => {
			const log = (
				code: AckCode,
				text: string | null,
				extra: { patientId?: string | null; resultIds?: string[] } = {},
			) => {
				const ack = buildAck({ code, controlId, text: text ?? undefined, original: parsed });
				return this.messages
					.create(
						{
							orgId: facility.id,
							controlId: controlId || null,
							messageType,
							raw,
							status: STATUS_BY_ACK[code],
							ackCode: code,
							ack,
							error: code === 'AA' ? null : text,
							patientId: extra.patientId ?? null,
							resultIds: extra.resultIds ?? [],
						},
						tx,
					)
					.then(() => ack);
			};

			if (messageType && isOrderStatusMessage(messageType)) {
				if (!controlId) {
					return { ack: await log('AR', 'MSH-10 (message control id) is empty'), stored: [], handled: false };
				}
				const outcome = await this.applyOrderStatus(tx, facility, mapOrderStatus(parsed));
				return { ack: await log(outcome.code, outcome.text), stored: [], handled: outcome.code === 'AA' };
			}

			let oru;
			try {
				oru = mapOru(parsed);
			} catch (error) {
				if (!(error instanceof OruMappingError)) {
					throw error;
				}
				// Wrong message type or no control id: not ours to take (AR). A broken ORU: application error (AE).
				const rejected = messageType !== 'ORU^R01' || !controlId;
				return { ack: await log(rejected ? 'AR' : 'AE', error.message), stored: [], handled: false };
			}

			const result = await this.results.ingest(tx, facility, oru, raw);
			if (result.status === 'unmatched') {
				return {
					ack: await log('AE', result.reason, { patientId: result.patientId }),
					stored: [],
					handled: false,
				};
			}
			const ack = await log('AA', null, {
				patientId: result.patientId,
				resultIds: result.results.map((stored) => stored.resultId),
			});
			return {
				ack,
				stored: result.results.map((stored) => ({ ...stored, patientId: result.patientId })),
				handled: true,
			};
		});

		for (const stored of outcome.stored) {
			await this.events.emit('result.received', stored);
		}
		if (!outcome.handled) {
			this.logger.warn(`HL7 ${controlId || '(no control id)'} from ${facility.slug} not stored`);
		}
		return outcome.ack;
	}

	/**
	 * An ORM/OML/ORR/ORL from the lab system: each ORC moves our order through `OrderService.applyLabStatus` (accepted,
	 * collected, rejected). AA when every update applied or was already the order's status; AE naming the ones that
	 * could not (an order not sent to this facility, a step the order's status does not allow, a control we don't track).
	 */
	private async applyOrderStatus(
		tx: Prisma.TransactionClient,
		facility: Organization,
		message: NormalizedOrderStatus,
	): Promise<{ code: AckCode; text: string | null }> {
		if (message.updates.length === 0) {
			return { code: 'AE', text: 'No ORC segment names an order (ORC-1 and ORC-2)' };
		}
		const problems: string[] = [];
		for (const update of message.updates) {
			if (!UUID.test(update.placerOrderId)) {
				problems.push(`ORC-2 ${update.placerOrderId} is not a Loopwise order`);
				continue;
			}
			try {
				const order = await this.orders.applyLabStatus(tx, facility.id, update);
				if (!order) {
					problems.push(
						`Order ${update.placerOrderId}: not sent to this facility, or ORC-1/ORC-5 not tracked`,
					);
				}
			} catch (error) {
				if (!(error instanceof HandlerError)) {
					throw error;
				}
				problems.push(`Order ${update.placerOrderId}: ${error.message}`);
			}
		}
		return problems.length === 0 ? { code: 'AA', text: null } : { code: 'AE', text: problems.join('; ') };
	}
}
