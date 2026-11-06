// Synthetic pharmacy and inventory demo (DESIGN.md §5.5): two suppliers, the clinic's medicines and supplies linked
// to the price list, deliveries with lots (one expiring within the alert window, one already expired, metformin
// below its reorder level), an inventory clerk login, and issued prescriptions waiting at the pharmacy (Ramon's
// maintenance medicines and amoxicillin, Pedro's tramadol on an S2 form). Product names are generic; license, CPR, LTO
// and lot numbers are made up. Idempotent: it only adds what is missing, so it runs on the fresh demo and, through
// `run-seed-inventory.ts`, on a database seeded before it existed.
import { DocumentSequenceRepository } from '../src/clinical/clinics/document-sequences/document-sequence.repository.js';
import { DocumentSequenceService } from '../src/clinical/clinics/document-sequences/document-sequence.service.js';
import { uuidv7 } from '../src/common/uuid.js';
import type { ItemCategory, Prisma, TaxType } from '../src/generated/prisma/client.js';
import { DEMO_CLINIC_CODE, DEMO_ORG_SLUG, DEMO_PATIENTS, DEMO_STAFF, verificationCode } from './seed-clinical.js';

const DAY = 24 * 60 * 60 * 1000;

/** The inventory clerk login added by this seed (password as the other demo logins). */
export const DEMO_INVENTORY_CLERK = 'stock.villanueva@loopwise.test';

interface SeedItem {
	sku: string;
	name: string;
	category: ItemCategory;
	genericName?: string;
	brandName?: string;
	strength?: string;
	dosageForm?: string;
	manufacturer?: string;
	fdaCprNo?: string;
	isRxOnly?: boolean;
	isDangerousDrug?: boolean;
	isAntimicrobial?: boolean;
	isPnf?: boolean;
	storageCondition?: string;
	unitOfMeasure: string;
	packSize?: number;
	taxType: TaxType;
	defaultCost: number;
	sellingPrice: number;
	reorderLevel: number;
	/** The price-list service that sells it (`seed-billing.ts`). */
	serviceCode?: string;
}

const ITEMS: readonly SeedItem[] = [
	{
		sku: 'MED-AMOX-500',
		name: 'Amoxicillin 500 mg capsule',
		category: 'MEDICINE',
		genericName: 'Amoxicillin',
		strength: '500 mg',
		dosageForm: 'capsule',
		manufacturer: 'Synthetic Generics Lab',
		fdaCprNo: 'SYN-DRP-0001',
		isRxOnly: true,
		isAntimicrobial: true,
		isPnf: true,
		storageCondition: 'Store below 30°C',
		unitOfMeasure: 'cap',
		packSize: 100,
		taxType: 'VATABLE',
		defaultCost: 4,
		sellingPrice: 8,
		reorderLevel: 100,
		serviceCode: 'MED-AMOX-500',
	},
	{
		sku: 'MED-AMOX-500-B',
		name: 'Amoxicillin 500 mg capsule',
		category: 'MEDICINE',
		genericName: 'Amoxicillin',
		brandName: 'Amoxisyn',
		strength: '500 mg',
		dosageForm: 'capsule',
		manufacturer: 'Synthetic Brands Inc.',
		fdaCprNo: 'SYN-DR-0002',
		isRxOnly: true,
		isAntimicrobial: true,
		isPnf: true,
		storageCondition: 'Store below 30°C',
		unitOfMeasure: 'cap',
		packSize: 100,
		taxType: 'VATABLE',
		defaultCost: 9,
		sellingPrice: 15,
		reorderLevel: 20,
	},
	{
		sku: 'MED-PCM-500',
		name: 'Paracetamol 500 mg tablet',
		category: 'MEDICINE',
		genericName: 'Paracetamol',
		strength: '500 mg',
		dosageForm: 'tablet',
		manufacturer: 'Synthetic Generics Lab',
		fdaCprNo: 'SYN-DRP-0003',
		isPnf: true,
		storageCondition: 'Store below 30°C',
		unitOfMeasure: 'tab',
		packSize: 100,
		taxType: 'VATABLE',
		defaultCost: 1,
		sellingPrice: 2.5,
		reorderLevel: 100,
		serviceCode: 'MED-PCM-500',
	},
	{
		sku: 'MED-METFORMIN-500',
		name: 'Metformin 500 mg tablet',
		category: 'MEDICINE',
		genericName: 'Metformin',
		strength: '500 mg',
		dosageForm: 'tablet',
		manufacturer: 'Synthetic Generics Lab',
		fdaCprNo: 'SYN-DRP-0004',
		isRxOnly: true,
		isPnf: true,
		unitOfMeasure: 'tab',
		packSize: 100,
		taxType: 'VAT_EXEMPT',
		defaultCost: 1.2,
		sellingPrice: 3,
		reorderLevel: 100,
		serviceCode: 'MED-METFORMIN-500',
	},
	{
		sku: 'MED-LOSARTAN-50',
		name: 'Losartan 50 mg tablet',
		category: 'MEDICINE',
		genericName: 'Losartan',
		strength: '50 mg',
		dosageForm: 'tablet',
		manufacturer: 'Synthetic Generics Lab',
		fdaCprNo: 'SYN-DRP-0005',
		isRxOnly: true,
		isPnf: true,
		unitOfMeasure: 'tab',
		packSize: 100,
		taxType: 'VAT_EXEMPT',
		defaultCost: 4,
		sellingPrice: 10,
		reorderLevel: 60,
		serviceCode: 'MED-LOSARTAN-50',
	},
	{
		sku: 'MED-AMLODIPINE-5',
		name: 'Amlodipine 5 mg tablet',
		category: 'MEDICINE',
		genericName: 'Amlodipine',
		strength: '5 mg',
		dosageForm: 'tablet',
		manufacturer: 'Synthetic Generics Lab',
		fdaCprNo: 'SYN-DRP-0006',
		isRxOnly: true,
		isPnf: true,
		unitOfMeasure: 'tab',
		packSize: 100,
		taxType: 'VAT_EXEMPT',
		defaultCost: 2,
		sellingPrice: 6,
		reorderLevel: 60,
	},
	{
		sku: 'MED-TRAMADOL-50',
		name: 'Tramadol 50 mg capsule',
		category: 'MEDICINE',
		genericName: 'Tramadol',
		strength: '50 mg',
		dosageForm: 'capsule',
		manufacturer: 'Synthetic Generics Lab',
		fdaCprNo: 'SYN-DRP-0007',
		isRxOnly: true,
		isDangerousDrug: true,
		storageCondition: 'Locked cabinet, below 30°C',
		unitOfMeasure: 'cap',
		packSize: 100,
		taxType: 'VATABLE',
		defaultCost: 6,
		sellingPrice: 12,
		reorderLevel: 20,
	},
	{
		sku: 'SUP-GAUZE',
		name: 'Sterile gauze pad 4 x 4',
		category: 'MEDICAL_SUPPLY',
		unitOfMeasure: 'pc',
		packSize: 100,
		taxType: 'VATABLE',
		defaultCost: 6,
		sellingPrice: 15,
		reorderLevel: 50,
		serviceCode: 'SUP-GAUZE',
	},
	{
		sku: 'SUP-GLOVES-M',
		name: 'Examination gloves, medium',
		category: 'MEDICAL_SUPPLY',
		unitOfMeasure: 'pc',
		packSize: 100,
		taxType: 'VATABLE',
		defaultCost: 3,
		sellingPrice: 8,
		reorderLevel: 100,
	},
];

const SUPPLIERS = [
	{
		name: 'Bohol Synthetic Pharma Distributors',
		tin: '000-111-222-000',
		address: 'CPG Avenue, Tagbilaran City, Bohol',
		contactPerson: 'Liza Ramos',
		contactNo: '(038) 000-0201',
		email: 'orders@bohol-synpharma.test',
		fdaLtoNo: 'SYN-LTO-DIST-0001',
	},
	{
		name: 'Visayas Synthetic Medical Supply',
		tin: '000-333-444-000',
		address: 'Cebu City, Cebu',
		contactPerson: 'Mark Uy',
		contactNo: '(032) 000-0301',
		email: 'sales@visayas-synmed.test',
		fdaLtoNo: 'SYN-LTO-DIST-0002',
	},
] as const;

interface SeedLot {
	sku: string;
	lotNo: string;
	/** Days from today; negative once expired. Null for supplies without expiry. */
	expiresInDays: number | null;
	quantity: number;
	unitCost: number;
}

/** Deliveries, by the supplier's DR number: when they came and what. */
const DELIVERIES: readonly { dr: string; supplier: number; daysAgo: number; lots: readonly SeedLot[] }[] = [
	{
		dr: 'SYN-DR-1001',
		supplier: 0,
		daysAgo: 200,
		lots: [
			{ sku: 'MED-PCM-500', lotNo: 'PCM-2504', expiresInDays: -20, quantity: 40, unitCost: 1 },
			{ sku: 'MED-AMOX-500', lotNo: 'AMX-2505', expiresInDays: 40, quantity: 15, unitCost: 4 },
			{ sku: 'MED-METFORMIN-500', lotNo: 'MET-2505', expiresInDays: 300, quantity: 30, unitCost: 1.2 },
		],
	},
	{
		dr: 'SYN-DR-1002',
		supplier: 0,
		daysAgo: 30,
		lots: [
			{ sku: 'MED-AMOX-500', lotNo: 'AMX-2609', expiresInDays: 540, quantity: 200, unitCost: 4 },
			{ sku: 'MED-AMOX-500-B', lotNo: 'AMS-2608', expiresInDays: 600, quantity: 50, unitCost: 9 },
			{ sku: 'MED-PCM-500', lotNo: 'PCM-2609', expiresInDays: 700, quantity: 500, unitCost: 1 },
			{ sku: 'MED-LOSARTAN-50', lotNo: 'LOS-2607', expiresInDays: 450, quantity: 300, unitCost: 4 },
			{ sku: 'MED-AMLODIPINE-5', lotNo: 'AML-2607', expiresInDays: 480, quantity: 200, unitCost: 2 },
			{ sku: 'MED-TRAMADOL-50', lotNo: 'TRM-2606', expiresInDays: 400, quantity: 40, unitCost: 6 },
		],
	},
	{
		dr: 'SYN-DR-2001',
		supplier: 1,
		daysAgo: 25,
		lots: [
			{ sku: 'SUP-GAUZE', lotNo: 'GZ-2609', expiresInDays: 1000, quantity: 300, unitCost: 6 },
			{ sku: 'SUP-GLOVES-M', lotNo: 'GLV-2609', expiresInDays: null, quantity: 400, unitCost: 3 },
		],
	},
];

const dateOnly = (date: Date) =>
	new Date(`${new Date(date.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)}T00:00:00Z`);

/** Adds what is missing of the pharmacy demo. Safe to run again. */
export async function seedInventory(tx: Prisma.TransactionClient, opts: { passwordHash: string }): Promise<void> {
	const sequences = new DocumentSequenceService(new DocumentSequenceRepository());
	const organization = await tx.organization.findUniqueOrThrow({ where: { slug: DEMO_ORG_SLUG } });
	const clinic = await tx.clinic.findFirstOrThrow({
		where: { organizationId: organization.id, code: DEMO_CLINIC_CODE },
	});
	const clerk = await ensureClerk(tx, organization.id, clinic.id, opts.passwordHash);

	const suppliers: string[] = [];
	for (const supplier of SUPPLIERS) {
		const existing = await tx.supplier.findFirst({
			where: { organizationId: organization.id, name: supplier.name },
		});
		suppliers.push(
			existing?.id ?? (await tx.supplier.create({ data: { ...supplier, organizationId: organization.id } })).id,
		);
	}

	const items = new Map<string, string>();
	for (const { serviceCode, ...item } of ITEMS) {
		const existing = await tx.inventoryItem.findUnique({
			where: { organizationId_sku: { organizationId: organization.id, sku: item.sku } },
		});
		const row = existing ?? (await tx.inventoryItem.create({ data: { ...item, organizationId: organization.id } }));
		items.set(item.sku, row.id);
		if (serviceCode) {
			// Only an unlinked service, and only when the item isn't sold by another one yet.
			const service = await tx.serviceItem.findFirst({
				where: { organizationId: organization.id, code: serviceCode, inventoryItemId: null },
			});
			const taken = await tx.serviceItem.findUnique({ where: { inventoryItemId: row.id } });
			if (service && !taken) {
				await tx.serviceItem.update({ where: { id: service.id }, data: { inventoryItemId: row.id } });
			}
		}
	}

	for (const delivery of DELIVERIES) {
		if (await tx.stockReceipt.findFirst({ where: { clinicId: clinic.id, deliveryReceiptNo: delivery.dr } })) {
			continue;
		}
		const receivedAt = new Date(Date.now() - delivery.daysAgo * DAY);
		const receipt = await tx.stockReceipt.create({
			data: {
				clinicId: clinic.id,
				supplierId: suppliers[delivery.supplier],
				receiptNo: await sequences.next(tx, clinic, 'STOCK_RECEIPT', receivedAt),
				deliveryReceiptNo: delivery.dr,
				supplierInvoiceNo: delivery.dr.replace('DR', 'SI'),
				receivedAt,
				receivedById: clerk,
				totalCost: delivery.lots.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0),
				remarks: 'Synthetic demo delivery',
			},
		});
		for (const seedLot of delivery.lots) {
			const itemId = items.get(seedLot.sku)!;
			const expiryDate =
				seedLot.expiresInDays === null ? null : dateOnly(new Date(Date.now() + seedLot.expiresInDays * DAY));
			const lot = await tx.inventoryLot.upsert({
				where: { itemId_clinicId_lotNo: { itemId, clinicId: clinic.id, lotNo: seedLot.lotNo } },
				create: {
					itemId,
					clinicId: clinic.id,
					supplierId: suppliers[delivery.supplier],
					lotNo: seedLot.lotNo,
					expiryDate,
					unitCost: seedLot.unitCost,
					receivedAt,
				},
				update: {},
			});
			await tx.stockReceiptItem.create({
				data: {
					receiptId: receipt.id,
					itemId,
					lotId: lot.id,
					lotNo: lot.lotNo,
					expiryDate: lot.expiryDate,
					quantity: seedLot.quantity,
					unitCost: seedLot.unitCost,
				},
			});
			await tx.inventoryLot.update({
				where: { id: lot.id },
				data: { quantityOnHand: { increment: seedLot.quantity } },
			});
			const balance = await tx.inventoryLot.aggregate({
				where: { clinicId: clinic.id, itemId },
				_sum: { quantityOnHand: true },
			});
			await tx.stockMovement.create({
				data: {
					clinicId: clinic.id,
					itemId,
					lotId: lot.id,
					type: 'RECEIPT',
					quantity: seedLot.quantity,
					unitCost: seedLot.unitCost,
					balanceAfter: balance._sum.quantityOnHand ?? 0,
					stockReceiptId: receipt.id,
					performedById: clerk,
					performedAt: receivedAt,
				},
			});
		}
	}

	await seedWaitingPrescriptions(tx, organization.id, clinic, sequences, items);
}

/** Rey Villanueva, the clinic's inventory clerk. */
async function ensureClerk(
	tx: Prisma.TransactionClient,
	organizationId: string,
	clinicId: string,
	passwordHash: string,
): Promise<string> {
	const existing = await tx.user.findUnique({ where: { email: DEMO_INVENTORY_CLERK } });
	const userId = existing?.id ?? uuidv7();
	if (!existing) {
		await tx.user.create({
			data: {
				id: userId,
				email: DEMO_INVENTORY_CLERK,
				name: 'Rey Villanueva',
				firstName: 'Rey',
				lastName: 'Villanueva',
				emailVerified: true,
				accounts: { create: { accountId: userId, providerId: 'credential', password: passwordHash } },
			},
		});
	}
	await tx.organizationMember.upsert({
		where: { organizationId_userId: { organizationId, userId } },
		create: { organizationId, userId, role: 'MEMBER' },
		update: {},
	});
	await tx.userClinicRole.createMany({ data: [{ userId, clinicId, role: 'INVENTORY_CLERK' }], skipDuplicates: true });
	return userId;
}

const WAITING_NOTE = 'Synthetic demo: waiting at the pharmacy.';

/** Ramon's maintenance medicines and amoxicillin today; Pedro's tramadol on an S2 form. Issued, not dispensed. */
async function seedWaitingPrescriptions(
	tx: Prisma.TransactionClient,
	organizationId: string,
	clinic: { id: string; code: string },
	sequences: DocumentSequenceService,
	items: ReadonlyMap<string, string>,
): Promise<void> {
	const doctorUser = await tx.user.findUniqueOrThrow({ where: { email: DEMO_STAFF.doctor } });
	const doctor = await tx.practitioner.findUniqueOrThrow({ where: { userId: doctorUser.id } });
	const encounterOf = async (patient: keyof typeof DEMO_PATIENTS, chiefComplaint: string) => {
		const row = await tx.patient.findUnique({
			where: { organizationId_patientNo: { organizationId, patientNo: DEMO_PATIENTS[patient].patientNo } },
		});
		return row
			? tx.encounter.findFirst({
					where: { patientId: row.id, clinicId: clinic.id, chiefComplaint },
					orderBy: { startedAt: 'desc' },
				})
			: null;
	};
	const signatory = {
		practitionerId: doctor.id,
		name: [doctor.title, doctor.firstName, doctor.lastName].filter(Boolean).join(' '),
		credentials: doctor.postNominals,
		specialty: doctor.specialty,
		licenseNumber: doctor.prcLicenseNo,
		ptrNumber: doctor.ptrNo,
		s2LicenseNo: doctor.s2LicenseNo ?? 'SYN-S2-0001',
		facilityName: (await tx.clinic.findUniqueOrThrow({ where: { id: clinic.id } })).name,
		facilityAddress: null,
		facilityPhone: null,
	};
	const prescriptions = [
		{
			encounter: await encounterOf('ramon', 'BP check, ran out of maintenance medicines'),
			daysAgo: 0,
			isDangerousDrug: false,
			s2FormSerialNo: null,
			items: [
				{
					genericName: 'Losartan',
					strength: '50 mg',
					dosageForm: 'tablet',
					quantity: 30,
					unit: 'tablets',
					sig: '1 tablet by mouth once a day for 30 days.',
					frequency: 'once a day',
					durationDays: 30,
					inventoryItemId: items.get('MED-LOSARTAN-50') ?? null,
				},
				{
					genericName: 'Amoxicillin',
					strength: '500 mg',
					dosageForm: 'capsule',
					quantity: 21,
					unit: 'capsules',
					sig: '1 capsule by mouth three times a day for 7 days.',
					frequency: 'three times a day',
					durationDays: 7,
					inventoryItemId: null,
				},
			],
		},
		{
			encounter: await encounterOf('pedro', 'Weight loss, thirst'),
			daysAgo: 3,
			isDangerousDrug: true,
			s2FormSerialNo: 'SYN-S2F-000123',
			items: [
				{
					genericName: 'Tramadol',
					strength: '50 mg',
					dosageForm: 'capsule',
					quantity: 10,
					quantityInWords: 'ten (10)',
					unit: 'capsules',
					sig: '1 capsule by mouth every 8 hours as needed for pain, for at most 3 days.',
					frequency: 'every 8 hours as needed',
					durationDays: 3,
					isPrn: true,
					inventoryItemId: items.get('MED-TRAMADOL-50') ?? null,
				},
			],
		},
	];
	for (const rx of prescriptions) {
		if (
			!rx.encounter ||
			(await tx.prescription.findFirst({ where: { encounterId: rx.encounter.id, notes: WAITING_NOTE } }))
		) {
			continue;
		}
		const issuedAt = new Date(Math.max(rx.encounter.startedAt.getTime(), Date.now() - rx.daysAgo * DAY));
		const created = await tx.prescription.create({
			data: {
				rxNo: await sequences.next(tx, clinic, 'RX', issuedAt),
				encounterId: rx.encounter.id,
				practitionerId: doctor.id,
				verificationCode: verificationCode(),
				issuedAt,
				validUntil: dateOnly(new Date(issuedAt.getTime() + 30 * DAY)),
				isDangerousDrug: rx.isDangerousDrug,
				s2FormSerialNo: rx.s2FormSerialNo,
				notes: WAITING_NOTE,
				createdAt: issuedAt,
				items: { create: rx.items.map((item, sortOrder) => ({ ...item, route: 'oral', sortOrder })) },
			},
		});
		// Drafted, then issued: the lines of an issued prescription are locked (trigger `prescription_items_lock`).
		await tx.prescription.update({ where: { id: created.id }, data: { documentStatus: 'ISSUED', signatory } });
	}
}
