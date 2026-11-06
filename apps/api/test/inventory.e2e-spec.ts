import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InventoryBillingService } from '../src/clinical/inventory/billing/inventory-billing.service.js';
import { InventoryModule } from '../src/clinical/inventory/inventory.module.js';
import { addDays, manilaToday } from '../src/clinical/inventory/stock/stock-rules.js';
import { ClinicalDbService } from '../src/clinical/rls/clinical-db.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	CLINICAL_CORE_MODULES,
	createClinicalTestApp,
	graphql,
	resetDatabase,
	signIn,
	useTestDatabase,
} from './clinical-test-app.js';
import {
	type ClinicScene,
	createClinicScene,
	createUser,
	type FixtureUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';

const ITEM_FIELDS = 'id sku displayName onHand usableOnHand isLowStock nearestExpiry serviceItem { id code price }';
const SAVE_ITEM = `mutation ($input: SaveInventoryItemInput!) { saveInventoryItem(input: $input) { ${ITEM_FIELDS} } }`;
const LINK = `mutation ($input: SetInventoryServiceLinkInput!) { setInventoryServiceLink(input: $input) { ${ITEM_FIELDS} } }`;
const SAVE_SUPPLIER = `mutation ($input: SaveSupplierInput!) { saveSupplier(input: $input) { id name fdaLtoNo } }`;
const RECEIVE = `mutation ($input: ReceiveStockInput!) { receiveStock(input: $input) {
	id receiptNo totalCost lines { lotId lotNo expiryDate quantity } } }`;
const ENTRY = `prescriptionId rxNo status isDangerousDrug s2Missing patient { name allergies }
	items { id genericName remaining dispensedQty candidates { itemId isPrescribed usableOnHand lots { id lotNo } } }`;
const QUEUE = `query { dispenseQueue { ${ENTRY} } }`;
const TO_DISPENSE = `query ($id: ID!) { prescriptionToDispense(prescriptionId: $id) { ${ENTRY} } }`;
const DISPENSE = `mutation ($input: DispensePrescriptionInput!) { dispensePrescription(input: $input) { ${ENTRY} } }`;
const LEDGER = `query ($itemId: ID!) { stockLedger(itemId: $itemId) {
	type quantity balanceAfter lotNo reason receiptNo rxNo performedByName } }`;
const ALERTS = `query { inventoryAlerts { asOf lowStock { sku usableOnHand reorderLevel }
	expiring { lotNo itemName daysToExpiry } expired { id lotNo quantityOnHand } } }`;
const DISPOSE = `mutation ($input: DisposeExpiredStockInput!) { disposeExpiredStock(input: $input) {
	type quantity balanceAfter } }`;

const item = (overrides: Record<string, unknown>) => ({
	category: 'MEDICINE',
	isRxOnly: true,
	isDangerousDrug: false,
	isAntimicrobial: false,
	isPnf: true,
	unitOfMeasure: 'cap',
	taxType: 'VATABLE',
	isActive: true,
	...overrides,
});

/**
 * Pharmacy and inventory: receiving into lots → dispensing an issued prescription first expiry first out (partly,
 * then the rest, with a substitution) → the stock ledger with balances; never an expired lot; the S2 check; the
 * alerts; the cashier's billing hook; the desk roles.
 */
describe('pharmacy and inventory (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let scene: ClinicScene;
	let pharmacist: FixtureUser;
	let clerk: FixtureUser;
	let cashier: FixtureUser;
	const cookies: Record<string, string[]> = {};
	const today = manilaToday();

	const errorOf = (res: { body: { errors?: { extensions?: Record<string, unknown> }[] } }) =>
		res.body.errors?.[0]?.extensions;
	const ok = async (who: string, query: string, variables: Record<string, unknown> = {}) => {
		const res = await graphql(app, cookies[who], query, variables);
		expect(res.body.errors).toBeUndefined();
		return Object.values(res.body.data as Record<string, unknown>)[0] as never;
	};

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createClinicalTestApp([...CLINICAL_CORE_MODULES, InventoryModule]);
		prisma = app.get(PrismaService);
		scene = await createClinicScene(prisma);
		pharmacist = await createUser(prisma, { firstName: 'Rosa', lastName: 'Garcia' });
		clerk = await createUser(prisma, { firstName: 'Rey', lastName: 'Villanueva' });
		cashier = await createUser(prisma, { firstName: 'Cora', lastName: 'Dela Cruz' });
		await grantClinicRoles(prisma, scene.clinic.id, pharmacist.id, ['PHARMACIST']);
		await grantClinicRoles(prisma, scene.clinic.id, clerk.id, ['INVENTORY_CLERK']);
		await grantClinicRoles(prisma, scene.clinic.id, cashier.id, ['CASHIER']);
		cookies.pharmacist = await signIn(app, pharmacist);
		cookies.clerk = await signIn(app, clerk);
		cookies.doctor = await signIn(app, scene.doctor);
	});

	afterAll(async () => {
		await app?.close();
	});

	it('receives, dispenses first expiry first out (partly, then the rest) and keeps the ledger', async () => {
		// The stock room sets up the item, links it to the price list and its supplier.
		const service = await prisma.serviceItem.create({
			data: {
				organizationId: scene.organization.id,
				code: 'MED-AMOX-500',
				name: 'Amoxicillin 500 mg capsule',
				category: 'MEDICINE',
				defaultPrice: 8,
				taxType: 'VATABLE',
				clinicPrices: { create: { clinicId: scene.clinic.id, price: 7.5 } },
			},
		});
		const generic = await ok('clerk', SAVE_ITEM, {
			input: item({
				sku: 'MED-AMOX-500',
				name: 'Amoxicillin 500 mg capsule',
				genericName: 'Amoxicillin',
				strength: '500 mg',
				reorderLevel: 20,
				sellingPrice: 8,
			}),
		});
		const brand = await ok('clerk', SAVE_ITEM, {
			input: item({
				sku: 'MED-AMOX-500-B',
				name: 'Amoxicillin 500 mg capsule',
				genericName: 'amoxicillin',
				brandName: 'Amoxisyn',
				strength: '500mg',
				sellingPrice: 15,
			}),
		});
		const linked = await ok('clerk', LINK, {
			input: { itemId: (generic as { id: string }).id, serviceItemId: service.id },
		});
		expect(linked).toMatchObject({ serviceItem: { code: 'MED-AMOX-500', price: 7.5 } });
		const supplier = await ok('clerk', SAVE_SUPPLIER, {
			input: { name: 'Synthetic Pharma Distributors', fdaLtoNo: 'SYN-LTO-1', isActive: true },
		});
		const genericId = (generic as { id: string }).id;
		const brandId = (brand as { id: string }).id;
		const supplierId = (supplier as { id: string }).id;

		// An expired lot already on the shelf: never dispensed.
		const expired = await prisma.inventoryLot.create({
			data: {
				itemId: genericId,
				clinicId: scene.clinic.id,
				lotNo: 'OLD-1',
				expiryDate: new Date(`${addDays(today, -5)}T00:00:00Z`),
				quantityOnHand: 50,
			},
		});

		// The pharmacist doesn't receive; the clerk does. An expired delivery is refused.
		const denied = await graphql(app, cookies.pharmacist, RECEIVE, {
			input: {
				supplierId,
				lines: [{ itemId: genericId, lotNo: 'X', expiryDate: addDays(today, 90), quantity: 1, unitCost: 1 }],
			},
		});
		expect(errorOf(denied)?.code).toBe('FORBIDDEN');
		const stale = await graphql(app, cookies.clerk, RECEIVE, {
			input: {
				supplierId,
				lines: [{ itemId: genericId, lotNo: 'X', expiryDate: addDays(today, -1), quantity: 1, unitCost: 1 }],
			},
		});
		expect(errorOf(stale)).toMatchObject({ errorCode: 'EXPIRED_ON_RECEIPT' });
		const receipt = await ok('clerk', RECEIVE, {
			input: {
				supplierId,
				deliveryReceiptNo: 'DR-1001',
				lines: [
					{ itemId: genericId, lotNo: 'soon-1', expiryDate: addDays(today, 30), quantity: 10, unitCost: 4 },
					{ itemId: genericId, lotNo: 'LATE-1', expiryDate: addDays(today, 400), quantity: 100, unitCost: 4 },
					{ itemId: brandId, lotNo: 'BR-1', expiryDate: addDays(today, 500), quantity: 20, unitCost: 9 },
				],
			},
		});
		expect(receipt).toMatchObject({
			receiptNo: expect.stringMatching(/-RR-\d{4}-000001$/),
			totalCost: 620,
			lines: [{ lotNo: 'SOON-1', quantity: 10 }, { lotNo: 'LATE-1' }, { lotNo: 'BR-1' }],
		});

		// The doctor's issued prescription reaches the pharmacy queue.
		const rx = await prisma.prescription.create({
			data: {
				rxNo: 'TEST-RX-1',
				encounterId: scene.encounter.id,
				practitionerId: scene.doctorPractitioner.id,
				verificationCode: 'TESTCODE01',
				items: {
					create: {
						genericName: 'Amoxicillin',
						strength: '500 mg',
						dosageForm: 'capsule',
						quantity: 21,
						sig: '1 capsule three times a day for 7 days',
					},
				},
			},
			include: { items: true },
		});
		await prisma.prescription.update({ where: { id: rx.id }, data: { documentStatus: 'ISSUED' } });
		const rxItem = rx.items[0].id;

		const queue = (await ok('pharmacist', QUEUE)) as { rxNo: string; patient: { name: string } }[];
		expect(queue).toEqual([
			expect.objectContaining({ rxNo: 'TEST-RX-1', patient: expect.objectContaining({ name: 'Maria Santos' }) }),
		]);
		const detail = (await ok('pharmacist', TO_DISPENSE, { id: rx.id })) as {
			items: { candidates: { itemId: string; lots: { lotNo: string }[] }[] }[];
		};
		const genericCandidate = detail.items[0].candidates.find((candidate) => candidate.itemId === genericId);
		expect(genericCandidate?.lots.map((lot) => lot.lotNo)).toEqual(['SOON-1', 'LATE-1']);

		// Never an expired lot, even chosen by hand; nobody but the pharmacy dispenses.
		const fromExpired = await graphql(app, cookies.pharmacist, DISPENSE, {
			input: {
				prescriptionId: rx.id,
				lines: [{ prescriptionItemId: rxItem, itemId: genericId, lotId: expired.id, quantity: 1 }],
			},
		});
		expect(errorOf(fromExpired)).toMatchObject({ errorCode: 'LOT_EXPIRED' });
		const byClerk = await graphql(app, cookies.clerk, DISPENSE, {
			input: { prescriptionId: rx.id, lines: [{ prescriptionItemId: rxItem, itemId: genericId, quantity: 1 }] },
		});
		expect(errorOf(byClerk)?.code).toBe('FORBIDDEN');

		// 15 now: 10 from the lot expiring first, 5 from the next.
		const partial = await ok('pharmacist', DISPENSE, {
			input: { prescriptionId: rx.id, lines: [{ prescriptionItemId: rxItem, itemId: genericId, quantity: 15 }] },
		});
		expect(partial).toMatchObject({ status: 'PARTIALLY_DISPENSED', items: [{ dispensedQty: 15, remaining: 6 }] });

		const tooMuch = await graphql(app, cookies.pharmacist, DISPENSE, {
			input: { prescriptionId: rx.id, lines: [{ prescriptionItemId: rxItem, itemId: brandId, quantity: 7 }] },
		});
		expect(errorOf(tooMuch)).toMatchObject({ errorCode: 'DISPENSE_QUANTITY_INVALID' });

		// The rest as another brand of the same generic: a recorded substitution.
		const done = await ok('pharmacist', DISPENSE, {
			input: {
				prescriptionId: rx.id,
				lines: [
					{
						prescriptionItemId: rxItem,
						itemId: brandId,
						quantity: 6,
						substitutionReason: 'Generic ran short',
					},
				],
			},
		});
		expect(done).toMatchObject({ status: 'DISPENSED', items: [{ dispensedQty: 21, remaining: 0 }] });
		expect(await prisma.prescriptionItem.findUnique({ where: { id: rxItem } })).toMatchObject({
			inventoryItemId: genericId,
		});

		const ledger = (await ok('pharmacist', LEDGER, { itemId: genericId })) as {
			type: string;
			quantity: number;
			balanceAfter: number;
			lotNo: string;
			rxNo: string | null;
		}[];
		expect(ledger.map(({ type, quantity, balanceAfter, lotNo }) => [type, quantity, balanceAfter, lotNo])).toEqual([
			['DISPENSE', -5, 145, 'LATE-1'],
			['DISPENSE', -10, 150, 'SOON-1'],
			['RECEIPT', 100, 160, 'LATE-1'],
			['RECEIPT', 10, 60, 'SOON-1'],
		]);
		expect(ledger[0].rxNo).toBe('TEST-RX-1');
		const brandLedger = (await ok('pharmacist', LEDGER, { itemId: brandId })) as { reason: string | null }[];
		expect(brandLedger[0].reason).toMatch(
			/^Substituted Amoxicillin 500 mg capsule \(Amoxisyn\) for Amoxicillin: Generic ran short/,
		);
		expect(
			(await prisma.inventoryLot.findMany({ where: { itemId: genericId }, orderBy: { lotNo: 'asc' } })).map(
				(lot) => [lot.lotNo, lot.quantityOnHand.toNumber()],
			),
		).toEqual([
			['LATE-1', 95],
			['OLD-1', 50],
			['SOON-1', 0],
		]);

		// The ledger is append-only; every step is audited.
		await expect(
			prisma.stockMovement.updateMany({ where: { itemId: genericId }, data: { reason: 'x' } }),
		).rejects.toThrow(/append-only/);
		expect(await prisma.auditLog.count({ where: { entityId: rx.id, event: 'prescription.dispense' } })).toBe(2);
		expect(
			await prisma.auditLog.findFirst({
				where: { entityId: rx.id, event: 'prescription.dispense', reason: { not: null } },
			}),
		).toMatchObject({
			userId: pharmacist.id,
			patientId: scene.patient.id,
			reason: expect.stringContaining('Substituted'),
		});
		expect(await prisma.auditLog.count({ where: { event: 'stock_receipt.create' } })).toBe(1);

		// The cashier's billing hook: what was dispensed on the visit, priced from the catalog.
		const charges = await app
			.get(ClinicalDbService)
			.asUser(cashier.id, (tx) => app.get(InventoryBillingService).dispensedChargesFor(tx, scene.encounter.id));
		expect(charges).toEqual([
			expect.objectContaining({
				inventoryItemId: genericId,
				serviceItemId: service.id,
				quantity: 15,
				unitPrice: 7.5,
			}),
			expect.objectContaining({ inventoryItemId: brandId, serviceItemId: null, quantity: 6, unitPrice: 15 }),
		]);
	});

	it('shows low, expiring and expired stock, and disposes of the expired lot', async () => {
		const pcm = (await ok('clerk', SAVE_ITEM, {
			input: item({
				sku: 'MED-PCM-500',
				name: 'Paracetamol 500 mg tablet',
				genericName: 'Paracetamol',
				strength: '500 mg',
				unitOfMeasure: 'tab',
				isRxOnly: false,
				reorderLevel: 100,
			}),
		})) as { id: string };
		const supplier = await prisma.supplier.findFirstOrThrow();
		await ok('clerk', RECEIVE, {
			input: {
				supplierId: supplier.id,
				lines: [{ itemId: pcm.id, lotNo: 'PCM-1', expiryDate: addDays(today, 20), quantity: 30, unitCost: 1 }],
			},
		});
		const alerts = (await ok('pharmacist', ALERTS)) as {
			lowStock: { sku: string }[];
			expiring: { lotNo: string; daysToExpiry: number }[];
			expired: { id: string; lotNo: string; quantityOnHand: number }[];
		};
		expect(alerts.lowStock).toEqual([{ sku: 'MED-PCM-500', usableOnHand: 30, reorderLevel: 100 }]);
		expect(alerts.expiring).toEqual([expect.objectContaining({ lotNo: 'PCM-1', daysToExpiry: 20 })]);
		expect(alerts.expired).toEqual([expect.objectContaining({ lotNo: 'OLD-1', quantityOnHand: 50 })]);

		const notExpired = await graphql(app, cookies.clerk, DISPOSE, {
			input: { lotId: (await prisma.inventoryLot.findFirstOrThrow({ where: { lotNo: 'PCM-1' } })).id },
		});
		expect(errorOf(notExpired)).toMatchObject({ errorCode: 'LOT_NOT_EXPIRED' });
		const disposed = await ok('clerk', DISPOSE, { input: { lotId: alerts.expired[0].id } });
		expect(disposed).toMatchObject({ type: 'EXPIRED_DISPOSAL', quantity: -50, balanceAfter: 95 });
		expect(((await ok('pharmacist', ALERTS)) as { expired: unknown[] }).expired).toEqual([]);
	});

	it('dispenses a dangerous drug only against a complete S2 prescription', async () => {
		const tramadol = (await ok('clerk', SAVE_ITEM, {
			input: item({
				sku: 'MED-TRAMADOL-50',
				name: 'Tramadol 50 mg capsule',
				genericName: 'Tramadol',
				strength: '50 mg',
				isDangerousDrug: true,
			}),
		})) as { id: string };
		const supplier = await prisma.supplier.findFirstOrThrow();
		await ok('clerk', RECEIVE, {
			input: {
				supplierId: supplier.id,
				lines: [
					{ itemId: tramadol.id, lotNo: 'TRM-1', expiryDate: addDays(today, 300), quantity: 20, unitCost: 6 },
				],
			},
		});
		const rx = await prisma.prescription.create({
			data: {
				rxNo: 'TEST-RX-2',
				encounterId: scene.encounter.id,
				practitionerId: scene.doctorPractitioner.id,
				verificationCode: 'TESTCODE02',
				items: {
					create: {
						genericName: 'Tramadol',
						strength: '50 mg',
						quantity: 10,
						sig: '1 capsule every 8 hours',
					},
				},
			},
			include: { items: true },
		});
		await prisma.prescription.update({ where: { id: rx.id }, data: { documentStatus: 'ISSUED' } });
		const detail = (await ok('pharmacist', TO_DISPENSE, { id: rx.id })) as {
			isDangerousDrug: boolean;
			s2Missing: string;
		};
		expect(detail.isDangerousDrug).toBe(true);
		expect(detail.s2Missing).toContain('S2 form serial number');
		const refused = await graphql(app, cookies.pharmacist, DISPENSE, {
			input: {
				prescriptionId: rx.id,
				lines: [{ prescriptionItemId: rx.items[0].id, itemId: tramadol.id, quantity: 10 }],
			},
		});
		expect(errorOf(refused)).toMatchObject({ errorCode: 'DANGEROUS_DRUG_RX_INCOMPLETE' });
		expect(
			(await prisma.inventoryLot.findFirstOrThrow({ where: { lotNo: 'TRM-1' } })).quantityOnHand.toNumber(),
		).toBe(20);
	});

	it("keeps the pharmacy out of the patient's chart beyond the prescriptions it dispenses", async () => {
		const other = await prisma.patient.create({
			data: {
				organizationId: scene.organization.id,
				patientNo: 'PT-OTHER',
				firstName: 'Liza',
				lastName: 'Mendoza',
				sex: 'FEMALE',
				birthDate: new Date('1990-01-01'),
			},
		});
		const visible = await app.get(ClinicalDbService).asUser(pharmacist.id, async (tx) => ({
			dispensed: await tx.patient.count({ where: { id: scene.patient.id } }),
			other: await tx.patient.count({ where: { id: other.id } }),
			drafts: await tx.prescription.count({ where: { documentStatus: 'DRAFT' } }),
		}));
		expect(visible).toEqual({ dispensed: 1, other: 0, drafts: 0 });
	});
});
