import type { PrescriptionStatus } from '../../generated/prisma/enums.js';

/** One item's prescribed and dispensed quantities. */
export interface DispensedLine {
	quantity: number;
	dispensedQty: number;
}

/**
 * The dispensing status an issued prescription moves to from its items' quantities: DISPENSED once every item is fully
 * dispensed, PARTIALLY_DISPENSED once anything is, else ACTIVE. Cancelled and expired prescriptions don't move.
 */
export function dispensingStatus(current: PrescriptionStatus, items: readonly DispensedLine[]): PrescriptionStatus {
	if (current === 'CANCELLED' || current === 'EXPIRED') {
		return current;
	}
	if (items.length > 0 && items.every((item) => item.dispensedQty >= item.quantity)) {
		return 'DISPENSED';
	}
	return items.some((item) => item.dispensedQty > 0) ? 'PARTIALLY_DISPENSED' : 'ACTIVE';
}
