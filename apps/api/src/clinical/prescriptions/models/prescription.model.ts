import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import type { Prisma } from '../../../generated/prisma/client.js';
import { DocumentStatus, MedicationRoute } from '../../../generated/prisma/enums.js';

registerEnumType(DocumentStatus, { name: 'DocumentStatus', description: 'Draft (editable), issued (locked), voided.' });
registerEnumType(MedicationRoute, { name: 'MedicationRoute' });

@ObjectType()
export class PrescriptionItem {
	@Field(() => ID)
	id: string;

	@Field(() => Int)
	position: number;

	@Field()
	genericName: string;

	@Field(() => String, { nullable: true })
	brandName: string | null;

	@Field(() => String, { nullable: true })
	strength: string | null;

	@Field(() => String, { nullable: true })
	form: string | null;

	@Field()
	dose: string;

	@Field(() => MedicationRoute)
	route: MedicationRoute;

	@Field()
	frequency: string;

	@Field(() => Int, { nullable: true })
	durationDays: number | null;

	@Field(() => Int)
	quantity: number;

	@Field(() => String, { nullable: true })
	quantityUnit: string | null;

	@Field(() => Int)
	refills: number;

	@Field(() => String, { nullable: true })
	instructions: string | null;
}

@ObjectType({
	description:
		"The clinician and facility printed on a document: the issue-time snapshot, or today's values for a draft.",
})
export class DocumentSignatory {
	@Field()
	name: string;

	@Field(() => String, { nullable: true })
	credentials: string | null;

	@Field(() => String, { nullable: true })
	licenseNumber: string | null;

	@Field(() => String, { nullable: true })
	ptrNumber: string | null;

	@Field()
	facilityName: string;

	@Field(() => String, { nullable: true })
	facilityAddress: string | null;

	@Field(() => String, { nullable: true })
	facilityPhone: string | null;
}

@ObjectType({ description: 'A prescription (℞) of an encounter (DESIGN.md §7).' })
export class Prescription {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	encounterId: string;

	@Field(() => ID)
	patientId: string;

	@Field(() => DocumentStatus)
	status: DocumentStatus;

	@Field(() => Int, { description: 'Moves on every change; pass it back as `expectedVersion`.' })
	version: number;

	@Field(() => String, { nullable: true })
	rxNumber: string | null;

	@Field(() => String, { nullable: true })
	notes: string | null;

	@Field(() => Date, { nullable: true })
	issuedAt: Date | null;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;

	@Field()
	createdAt: Date;

	@Field(() => [PrescriptionItem])
	items: PrescriptionItem[];

	@Field(() => ID)
	prescriberId: string;

	/** Filled for the print view (`prescription(id)`); null in the encounter record. */
	@Field(() => DocumentSignatory, { nullable: true })
	signatory: DocumentSignatory | null;
}

export type PrescriptionRow = Prisma.PrescriptionGetPayload<{ include: { items: true } }>;

export function toPrescription(row: PrescriptionRow, signatory: DocumentSignatory | null = null): Prescription {
	return {
		id: row.id,
		encounterId: row.encounterId,
		patientId: row.patientId,
		status: row.status,
		version: row.version,
		rxNumber: row.rxNumber,
		notes: row.notes,
		issuedAt: row.issuedAt,
		voidedAt: row.voidedAt,
		voidReason: row.voidReason,
		createdAt: row.createdAt,
		prescriberId: row.prescriberId,
		signatory,
		items: [...row.items]
			.sort((a, b) => a.position - b.position)
			.map((item) => ({
				id: item.id,
				position: item.position,
				genericName: item.genericName,
				brandName: item.brandName,
				strength: item.strength,
				form: item.form,
				dose: item.dose,
				route: item.route,
				frequency: item.frequency,
				durationDays: item.durationDays,
				quantity: item.quantity,
				quantityUnit: item.quantityUnit,
				refills: item.refills,
				instructions: item.instructions,
			})),
	};
}
