import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

import { PrescriptionStatus } from '../../../prescriptions/prescriptions.enums.js';
import { InventoryLotModel } from '../../stock/models/stock.model.js';

@ObjectType({ description: 'The patient as the pharmacy sees them: who to hand the medicines to, and allergies.' })
export class DispensePatient {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field()
	patientNo: string;

	@Field({ description: 'YYYY-MM-DD.' })
	birthDate: string;

	@Field()
	sex: string;

	@Field(() => [String], { description: 'Active allergies: "Penicillin (rash)".' })
	allergies: string[];
}

@ObjectType({ description: 'A stock item that can fill a prescribed medicine: the same generic (RA 6675).' })
export class DispenseCandidate {
	@Field(() => ID)
	itemId: string;

	@Field({ description: 'Generic name first, brand after it.' })
	displayName: string;

	@Field(() => String, { nullable: true })
	brandName: string | null;

	@Field(() => String, { nullable: true })
	strength: string | null;

	@Field(() => String, { nullable: true })
	dosageForm: string | null;

	@Field()
	unitOfMeasure: string;

	@Field()
	isDangerousDrug: boolean;

	@Field({ description: 'The item prescribed (linked or the brand written); else giving it is a substitution.' })
	isPrescribed: boolean;

	@Field(() => Float)
	usableOnHand: number;

	@Field(() => [InventoryLotModel], { description: 'Unexpired lots with stock, first expiry first out.' })
	lots: InventoryLotModel[];
}

@ObjectType({ description: 'One medicine of a prescription at the pharmacy.' })
export class DispenseItem {
	@Field(() => ID, { description: 'The prescription item.' })
	id: string;

	@Field()
	genericName: string;

	@Field(() => String, { nullable: true })
	brandName: string | null;

	@Field(() => String, { nullable: true })
	strength: string | null;

	@Field(() => String, { nullable: true })
	dosageForm: string | null;

	@Field()
	sig: string;

	@Field(() => Float)
	quantity: number;

	@Field(() => String, { nullable: true })
	quantityInWords: string | null;

	@Field(() => String, { nullable: true })
	unit: string | null;

	@Field(() => Float)
	dispensedQty: number;

	@Field(() => Float)
	remaining: number;

	@Field(() => ID, { nullable: true, description: 'The stock item linked to the line, when any.' })
	inventoryItemId: string | null;

	@Field({ description: 'The Rx or a matching stock item is a dangerous drug (RA 9165).' })
	isDangerousDrug: boolean;

	@Field(() => [DispenseCandidate], { description: 'Filled by `prescriptionToDispense` only.' })
	candidates: DispenseCandidate[];
}

@ObjectType({ description: "An issued prescription in the clinic's dispense queue." })
export class DispenseQueueEntry {
	@Field(() => ID)
	prescriptionId: string;

	@Field()
	rxNo: string;

	@Field(() => PrescriptionStatus)
	status: PrescriptionStatus;

	@Field()
	issuedAt: Date;

	@Field(() => String, { nullable: true })
	validUntil: string | null;

	@Field({ description: 'A dangerous-drug (S2 / yellow) prescription.' })
	isDangerousDrug: boolean;

	@Field(() => String, { nullable: true, description: 'DOH dangerous-drugs prescription form serial.' })
	s2FormSerialNo: string | null;

	@Field(() => String, { nullable: true })
	prescriberName: string | null;

	@Field(() => String, { nullable: true, description: "The prescriber's PDEA S2 license, as printed." })
	prescriberS2LicenseNo: string | null;

	@Field(() => String, {
		nullable: true,
		description:
			'What a dangerous drug on this Rx still needs before it is dispensed (RA 9165); null when complete.',
	})
	s2Missing: string | null;

	@Field(() => ID)
	encounterId: string;

	@Field()
	encounterNo: string;

	@Field(() => DispensePatient)
	patient: DispensePatient;

	@Field(() => [DispenseItem])
	items: DispenseItem[];
}
