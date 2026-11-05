import { Injectable } from '@nestjs/common';

import type { Organization, Prisma } from '../../generated/prisma/client.js';
import type { NormalizedOru, PatientIdentifier } from '../../hl7/oru-mapper.js';
import { ClinicalAuditRepository } from '../audit/clinical-audit.repository.js';
import { OrderService } from '../orders/order.service.js';
import { ResultRepository } from './result.repository.js';

type Tx = Prisma.TransactionClient;

/** PID-3 identifier types and authorities that mean a PhilHealth number. */
const PHILHEALTH_TYPES = new Set(['NH', 'NI', 'PHIC']);
const PHILHEALTH_AUTHORITY = /^(philhealth|phic)$/i;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type IngestOutcome =
	| { status: 'stored'; patientId: string; results: { resultId: string; orderId: string | null }[] }
	| { status: 'unmatched'; reason: string; patientId: string | null };

/**
 * Stores the results of a normalized ORU (DESIGN.md §2 step 5): deterministic patient matching (no fuzzy matching:
 * a wrong match is worse than a message left for review), one `Result` per observation, the order moved to
 * `resulted`, and an audit row per result. Runs in the ingest's system transaction.
 */
@Injectable()
export class ResultIngestService {
	constructor(
		private readonly results: ResultRepository,
		private readonly orders: OrderService,
		private readonly audit: ClinicalAuditRepository,
	) {}

	async ingest(tx: Tx, facility: Organization, oru: NormalizedOru, rawHl7: string): Promise<IngestOutcome> {
		const match = await this.matchPatient(tx, facility, oru);
		if (match.status === 'unmatched') {
			return match;
		}
		const { patientId } = match;

		const stored: { resultId: string; orderId: string | null }[] = [];
		for (const order of oru.orders) {
			const linked =
				(order.placerOrderNumber && UUID.test(order.placerOrderNumber)
					? await this.results.findOrderForFacility(tx, order.placerOrderNumber, facility.id)
					: null) ??
				(order.code ? await this.results.findOpenOrderByCode(tx, patientId, facility.id, order.code) : null);
			const orderId = linked && linked.patientId === patientId ? linked.id : null;

			for (const observation of order.observations) {
				const result = await this.results.create(tx, {
					orderId,
					patientId,
					sourceOrgId: facility.id,
					code: observation.code,
					codeSystem: observation.codeSystem,
					display: observation.display,
					value: observation.value,
					valueNumeric: observation.valueNumeric,
					unit: observation.unit,
					refRange: observation.referenceRange,
					flag: observation.flag,
					rawHl7,
					resultedAt: observation.observedAt ?? order.resultedAt ?? oru.sentAt ?? new Date(),
				});
				await this.audit.write(tx, {
					userId: null,
					orgId: facility.id,
					patientId,
					action: 'result.receive',
					resource: 'result',
					resourceId: result.id,
					origin: { via: 'hl7', controlId: oru.controlId, messageType: oru.messageType },
				});
				stored.push({ resultId: result.id, orderId });
			}
			if (orderId) {
				await this.advanceOrderOnResult(tx, orderId);
			}
		}
		return { status: 'stored', patientId, results: stored };
	}

	/** The seam to the order lifecycle (owned by `clinical/orders/`): a new result makes the order `resulted`. */
	private advanceOrderOnResult(tx: Tx, orderId: string): Promise<boolean> {
		return this.orders.setResulted(tx, orderId);
	}

	/**
	 * 1. An identifier the sending facility issued (PID-3 value at that organization).
	 * 2. A PhilHealth number, at any facility.
	 * 3. The patient of the order the message answers (placer number = `ClinicalOrder.id`, sent to this facility).
	 * Each step must give exactly one patient; the order, when given, must agree; a date of birth must agree.
	 */
	private async matchPatient(
		tx: Tx,
		facility: Organization,
		oru: NormalizedOru,
	): Promise<{ status: 'matched'; patientId: string } | Extract<IngestOutcome, { status: 'unmatched' }>> {
		const { identifiers } = oru.patient;
		const unmatched = (reason: string, patientId: string | null = null) =>
			({ status: 'unmatched', reason, patientId }) as const;

		const placers = unique(
			oru.orders
				.map((order) => order.placerOrderNumber)
				.filter((value): value is string => !!value && UUID.test(value)),
		);
		const orderPatients: string[] = [];
		for (const placer of placers) {
			const order = await this.results.findOrderForFacility(tx, placer, facility.id);
			if (order) {
				orderPatients.push(order.patientId);
			}
		}
		const orderPatient = unique(orderPatients);
		if (orderPatient.length > 1) {
			return unmatched('The referenced orders belong to different patients');
		}

		let patientId: string | null = null;
		let matchedBy = '';
		const local = await this.results.patientIdsByIdentifierAtOrg(
			tx,
			facility.id,
			identifiers.map((identifier) => identifier.value),
		);
		if (local.length > 1) {
			return unmatched('PID-3 identifiers match more than one patient at this facility');
		}
		if (local.length === 1) {
			[patientId] = local;
			matchedBy = 'facility identifier';
		}
		if (!patientId) {
			const philHealth = await this.results.patientIdsByPhilHealth(
				tx,
				identifiers.filter(isPhilHealth).map((i) => i.value),
			);
			if (philHealth.length > 1) {
				return unmatched('The PhilHealth number matches more than one patient');
			}
			if (philHealth.length === 1) {
				[patientId] = philHealth;
				matchedBy = 'PhilHealth number';
			}
		}
		if (!patientId && orderPatient.length === 1) {
			[patientId] = orderPatient;
			matchedBy = 'order';
		}
		if (!patientId) {
			return unmatched(
				placers.length > 0
					? 'No patient matches PID-3 and the referenced order was not sent to this facility'
					: 'No patient matches the PID-3 identifiers (facility identifier or PhilHealth number) and no order is referenced',
			);
		}
		if (orderPatient.length === 1 && orderPatient[0] !== patientId) {
			return unmatched(`The patient matched by ${matchedBy} is not the patient of the referenced order`);
		}
		if (oru.patient.birthDate) {
			const patient = await this.results.findPatient(tx, patientId);
			const birthDate = patient?.birthDate?.toISOString().slice(0, 10);
			if (birthDate && birthDate !== oru.patient.birthDate) {
				return unmatched(`PID-7 date of birth does not match the patient matched by ${matchedBy}`, patientId);
			}
		}
		return { status: 'matched', patientId };
	}
}

function isPhilHealth(identifier: PatientIdentifier): boolean {
	return (
		PHILHEALTH_TYPES.has(identifier.typeCode.toUpperCase()) ||
		PHILHEALTH_AUTHORITY.test(identifier.assigningAuthority)
	);
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}
