import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../generated/prisma/client.js';
import { DocumentSignatory } from '../../practitioners/models/document-signatory.model.js';
import { DocumentStatus, PrescriptionStatus } from '../prescriptions.enums.js';

@ObjectType({ description: 'One medicine of a prescription (generic name first, RA 6675).' })
export class PrescriptionItem {
	@Field(() => ID)
	id: string;

	@Field(() => Int)
	sortOrder: number;

	@Field()
	genericName: string;

	@Field(() => String, { nullable: true })
	brandName: string | null;

	@Field(() => String, { nullable: true })
	strength: string | null;

	@Field(() => String, { nullable: true, description: 'e.g. "tablet", "suspension 250 mg/5 mL".' })
	dosageForm: string | null;

	@Field({ description: 'The directions as printed.' })
	sig: string;

	@Field(() => String, { nullable: true, description: 'PO, SL, TOP, IM …' })
	route: string | null;

	@Field(() => String, { nullable: true })
	frequency: string | null;

	@Field(() => Int, { nullable: true })
	durationDays: number | null;

	@Field({ description: 'As needed.' })
	isPrn: boolean;

	@Field(() => Float)
	quantity: number;

	@Field(() => String, { nullable: true })
	unit: string | null;

	@Field(() => String, { nullable: true, description: 'Dangerous drugs (RA 9165): "twenty (20)".' })
	quantityInWords: string | null;

	@Field(() => Float)
	dispensedQty: number;
}

@ObjectType({ description: 'A prescription (℞) of an encounter (DESIGN.md §5).' })
export class Prescription {
	@Field(() => ID)
	id: string;

	@Field({ description: "The clinic's Rx number, e.g. TAG-RX-2026-000123 (assigned with the draft)." })
	rxNo: string;

	@Field(() => ID)
	encounterId: string;

	@Field(() => ID)
	patientId: string;

	@Field(() => ID, { description: 'The prescriber.' })
	practitionerId: string;

	@Field(() => DocumentStatus)
	documentStatus: DocumentStatus;

	@Field(() => PrescriptionStatus, { description: 'CANCELLED once voided.' })
	status: PrescriptionStatus;

	@Field(() => Int, { description: 'Moves on every change; pass it back as `expectedVersion`.' })
	version: number;

	@Field({ description: 'A dangerous drug (S2 / yellow Rx, RA 9165).' })
	isDangerousDrug: boolean;

	@Field(() => String, { nullable: true })
	s2FormSerialNo: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	validUntil: string | null;

	@Field({ description: 'Printed (and as a QR) so a pharmacy can check the Rx.' })
	verificationCode: string;

	@Field(() => String, { nullable: true })
	notes: string | null;

	@Field(() => Date, { nullable: true, description: 'Null while a draft.' })
	issuedAt: Date | null;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;

	@Field()
	createdAt: Date;

	@Field(() => [PrescriptionItem])
	items: PrescriptionItem[];

	/** The issue-time snapshot, or today's values for a draft; filled for the print view (`prescription(id)`). */
	@Field(() => DocumentSignatory, { nullable: true })
	signatory: DocumentSignatory | null;
}

export const PRESCRIPTION_INCLUDE = {
	items: { orderBy: { sortOrder: 'asc' } },
	encounter: { select: { patientId: true, clinicId: true } },
} satisfies Prisma.PrescriptionInclude;

export type PrescriptionRow = Prisma.PrescriptionGetPayload<{ include: typeof PRESCRIPTION_INCLUDE }>;

export function toPrescription(row: PrescriptionRow, signatory: DocumentSignatory | null = null): Prescription {
	return {
		id: row.id,
		rxNo: row.rxNo,
		encounterId: row.encounterId,
		patientId: row.encounter.patientId,
		practitionerId: row.practitionerId,
		documentStatus: row.documentStatus,
		status: row.status,
		version: row.version,
		isDangerousDrug: row.isDangerousDrug,
		s2FormSerialNo: row.s2FormSerialNo,
		validUntil: row.validUntil?.toISOString().slice(0, 10) ?? null,
		verificationCode: row.verificationCode ?? '',
		notes: row.notes,
		issuedAt: row.documentStatus === 'ISSUED' ? row.issuedAt : null,
		voidedAt: row.voidedAt,
		voidReason: row.voidReason,
		createdAt: row.createdAt,
		signatory,
		items: row.items.map((item) => ({
			id: item.id,
			sortOrder: item.sortOrder,
			genericName: item.genericName,
			brandName: item.brandName,
			strength: item.strength,
			dosageForm: item.dosageForm,
			sig: item.sig,
			route: item.route,
			frequency: item.frequency,
			durationDays: item.durationDays,
			isPrn: item.isPrn,
			quantity: item.quantity.toNumber(),
			unit: item.unit,
			quantityInWords: item.quantityInWords,
			dispensedQty: item.dispensedQty.toNumber(),
		})),
	};
}
