import type { ZodType, ZodTypeDef } from 'zod/v3';

import type { Prisma } from '../../../generated/prisma/client.js';
import { InvalidBillingInputError } from '../billing.errors.js';
import type { ResolvedLine } from '../service-items/service-item.service.js';
import type { BillingEncounter, InvoiceLineData } from './invoice.repository.js';
import type { LineAmounts } from './invoice-totals.service.js';
import type { InvoiceRow } from './models/invoice.model.js';

/* The invoice service's helpers: the lines it stores, the buyer's name, and parsing with the shared rules. */

/**
 * A line saved without the pharmacy ledger rows it bills (the billing form doesn't send them) keeps those of the
 * draft's line for the same item, so a dispensed medicine stays billed once.
 */
export function keepBilledMovements(lines: ResolvedLine[], current: InvoiceRow | null): ResolvedLine[] {
	if (!current) {
		return lines;
	}
	const used = new Set<string>();
	return lines.map((line) => {
		if (line.stockMovementIds.length > 0) {
			return line;
		}
		const previous = current.lines.find(
			(candidate) =>
				!used.has(candidate.id) &&
				candidate.stockMovementIds.length > 0 &&
				(line.serviceItemId
					? candidate.serviceItemId === line.serviceItemId
					: candidate.description === line.description),
		);
		if (!previous) {
			return line;
		}
		used.add(previous.id);
		return { ...line, stockMovementIds: previous.stockMovementIds };
	});
}

/** The patient as printed on the invoice (and as SC/PWD beneficiary). */
export function buyerNameOf(encounter: BillingEncounter): string {
	const { firstName, middleName, lastName, suffix } = encounter.patient;
	return [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
}

export function toLineRow(
	line: ResolvedLine,
	index: number,
	encounter: BillingEncounter,
	amounts: LineAmounts,
): InvoiceLineData {
	const category = line.item?.category;
	const isProfessionalFee = category === 'PROFESSIONAL_FEE' || Boolean(line.item?.isPfShareable);
	return {
		serviceItemId: line.serviceItemId,
		encounterId: encounter.id,
		// Whose fee: the doctor the line names, else the visit's doctor for the consultation and professional fees.
		practitionerId:
			line.practitionerId ?? (isProfessionalFee || category === 'CONSULTATION' ? encounter.practitionerId : null),
		description: line.description,
		quantity: line.quantity,
		unitPrice: line.unitPrice,
		taxType: line.taxType,
		isProfessionalFee,
		stockMovementIds: line.stockMovementIds,
		sortOrder: index,
		vatAmount: amounts.vatAmount,
		discountAmount: amounts.discountAmount,
		lineTotal: amounts.lineTotal,
	};
}

export const asObject = (value: Prisma.InputJsonValue | null | undefined): Prisma.InputJsonObject =>
	value && typeof value === 'object' && !Array.isArray(value) ? (value as Prisma.InputJsonObject) : {};

/** Parses with a shared schema; the first problem becomes a BAD_REQUEST the user can act on. */
export function parseOrThrow<T>(schema: ZodType<T, ZodTypeDef, unknown>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success) {
		const issue = result.error.issues[0];
		throw new InvalidBillingInputError(issue.message, issue.path.join('.') || undefined);
	}
	return result.data;
}
