import type {
	AdjustStockInput,
	DispenseEntryFieldsFragment,
	DispensePrescriptionInput,
	DisposeExpiredStockInput,
	InventoryAlertsQuery,
	InventoryItemFieldsFragment,
	InventoryLotFieldsFragment,
	InventoryServiceOptionsQuery,
	ItemCategory,
	ReceiveStockInput,
	RecordConsumptionInput,
	RecordDamagedStockInput,
	SaveInventoryItemInput,
	SaveSupplierInput,
	SetInventoryServiceLinkInput,
	StockMovementFieldsFragment,
	StockReceiptFieldsFragment,
	SupplierFieldsFragment,
} from '@/graphql/generated/graphql';

import {
	AdjustStockDocument,
	DispensePrescriptionDocument,
	DispenseQueueDocument,
	DisposeExpiredStockDocument,
	InventoryAlertsDocument,
	InventoryItemDocument,
	InventoryItemsDocument,
	InventoryLotsDocument,
	InventoryServiceOptionsDocument,
	PrescriptionToDispenseDocument,
	ReceiveStockDocument,
	RecordDamagedStockDocument,
	RecordStockConsumptionDocument,
	SaveInventoryItemDocument,
	SaveSupplierDocument,
	SetInventoryServiceLinkDocument,
	StockLedgerDocument,
	StockReceiptsDocument,
	SuppliersDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

export type InventoryItem = InventoryItemFieldsFragment;
export type InventoryLot = InventoryLotFieldsFragment;
export type StockMovement = StockMovementFieldsFragment;
export type Supplier = SupplierFieldsFragment;
export type StockReceipt = StockReceiptFieldsFragment;
export type DispenseEntry = DispenseEntryFieldsFragment;
export type DispenseItem = DispenseEntry['items'][number];
export type DispenseCandidate = DispenseItem['candidates'][number];
export type InventoryAlerts = InventoryAlertsQuery['inventoryAlerts'];
export type InventoryServiceOption = InventoryServiceOptionsQuery['inventoryServiceOptions'][number];

/**
 * Pharmacy and inventory (`apps/api/src/clinical/inventory`): the item master, suppliers, receiving, lots and the
 * stock ledger, the alerts, and the dispense queue. Everything sits under `['pharmacy', …]`, so a stock change
 * refreshes the pages with one `pharmacyApi.all` invalidation.
 */
export const pharmacyApi = {
	/** Every pharmacy query, for one invalidation after any stock change. */
	all: { pathFilter: () => ({ queryKey: [['pharmacy']] }) },
	items: query<
		{ search?: string | null; category?: ItemCategory | null; includeInactive?: boolean },
		InventoryItem[]
	>(['pharmacy', 'items'], async (variables) => (await runQuery(InventoryItemsDocument, variables)).inventoryItems),
	item: query<{ id: string }, InventoryItem>(
		['pharmacy', 'item'],
		async ({ id }) => (await runQuery(InventoryItemDocument, { id })).inventoryItem,
	),
	serviceOptions: query<Record<string, never>, InventoryServiceOption[]>(
		['pharmacy', 'serviceOptions'],
		async () => (await runQuery(InventoryServiceOptionsDocument, {})).inventoryServiceOptions,
	),
	saveItem: mutation<SaveInventoryItemInput, InventoryItem>(
		['pharmacy', 'saveItem'],
		async (input) => (await runMutation(SaveInventoryItemDocument, { input })).saveInventoryItem,
	),
	setServiceLink: mutation<SetInventoryServiceLinkInput, InventoryItem>(
		['pharmacy', 'setServiceLink'],
		async (input) => (await runMutation(SetInventoryServiceLinkDocument, { input })).setInventoryServiceLink,
	),
	lots: query<{ itemId: string; includeEmpty?: boolean }, InventoryLot[]>(
		['pharmacy', 'lots'],
		async (variables) => (await runQuery(InventoryLotsDocument, variables)).inventoryLots,
	),
	ledger: query<{ itemId: string; limit?: number }, StockMovement[]>(
		['pharmacy', 'ledger'],
		async (variables) => (await runQuery(StockLedgerDocument, variables)).stockLedger,
	),
	alerts: query<Record<string, never>, InventoryAlerts>(
		['pharmacy', 'alerts'],
		async () => (await runQuery(InventoryAlertsDocument, {})).inventoryAlerts,
	),
	suppliers: query<{ includeInactive?: boolean }, Supplier[]>(
		['pharmacy', 'suppliers'],
		async (variables) => (await runQuery(SuppliersDocument, variables)).suppliers,
	),
	saveSupplier: mutation<SaveSupplierInput, Supplier>(
		['pharmacy', 'saveSupplier'],
		async (input) => (await runMutation(SaveSupplierDocument, { input })).saveSupplier,
	),
	receipts: query<{ limit?: number }, StockReceipt[]>(
		['pharmacy', 'receipts'],
		async (variables) => (await runQuery(StockReceiptsDocument, variables)).stockReceipts,
	),
	receive: mutation<ReceiveStockInput, StockReceipt>(
		['pharmacy', 'receive'],
		async (input) => (await runMutation(ReceiveStockDocument, { input })).receiveStock,
	),
	adjust: mutation<AdjustStockInput, StockMovement>(
		['pharmacy', 'adjust'],
		async (input) => (await runMutation(AdjustStockDocument, { input })).adjustStock,
	),
	disposeExpired: mutation<DisposeExpiredStockInput, StockMovement>(
		['pharmacy', 'disposeExpired'],
		async (input) => (await runMutation(DisposeExpiredStockDocument, { input })).disposeExpiredStock,
	),
	recordDamaged: mutation<RecordDamagedStockInput, StockMovement>(
		['pharmacy', 'recordDamaged'],
		async (input) => (await runMutation(RecordDamagedStockDocument, { input })).recordDamagedStock,
	),
	recordConsumption: mutation<RecordConsumptionInput, StockMovement[]>(
		['pharmacy', 'recordConsumption'],
		async (input) => (await runMutation(RecordStockConsumptionDocument, { input })).recordStockConsumption,
	),
	queue: query<{ includeDone?: boolean }, DispenseEntry[]>(
		['pharmacy', 'queue'],
		async (variables) => (await runQuery(DispenseQueueDocument, variables)).dispenseQueue,
	),
	toDispense: query<{ prescriptionId: string }, DispenseEntry>(
		['pharmacy', 'toDispense'],
		async (variables) => (await runQuery(PrescriptionToDispenseDocument, variables)).prescriptionToDispense,
	),
	dispense: mutation<DispensePrescriptionInput, DispenseEntry>(
		['pharmacy', 'dispense'],
		async (input) => (await runMutation(DispensePrescriptionDocument, { input })).dispensePrescription,
	),
};
