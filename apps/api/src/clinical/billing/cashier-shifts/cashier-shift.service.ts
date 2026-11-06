import { CASH_DENOMINATIONS } from '@loopwise/shared/invoice';
import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import {
	InvalidBillingInputError,
	NoOpenShiftError,
	ShiftAlreadyOpenError,
	ShiftClosedError,
	ShiftNotYoursError,
} from '../billing.errors.js';
import { type BillingActor, isBillingAdmin } from '../billing-access.js';
import { manilaDayRange } from '../billing-dates.js';
import { CashierShiftRepository, type CashierShiftRow } from './cashier-shift.repository.js';
import type { CashierShiftsInput, CloseCashierShiftInput, OpenCashierShiftInput } from './dto/cashier-shift.input.js';
import { type CashierShift, toCashierShift } from './models/cashier-shift.model.js';

const ZERO = new Prisma.Decimal(0);

/**
 * The cashier's shift (`cashier_shifts`): opened with the cash float; every payment the cashier takes at the clinic
 * attaches to their open shift (one per cashier per clinic; none open → payments are refused). The X reading is the
 * mid-shift summary by method, leaving it open; the Z reading closes it: expected cash (float + cash collected), the
 * cash counted by bill and coin, and the variance (counted − expected). Every step is audited.
 */
@Injectable()
export class CashierShiftService {
	private readonly logger = new Logger(CashierShiftService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly shifts: CashierShiftRepository,
		private readonly audit: AuditService,
	) {}

	async open(actor: BillingActor, input: OpenCashierShiftInput): Promise<CashierShift> {
		return this.db.asUser(actor.userId, async (tx) => {
			const current = await this.shifts.findOpen(tx, actor.clinicId, actor.userId);
			if (current) {
				throw new ShiftAlreadyOpenError(current.id);
			}
			const row = await this.shifts.create(tx, {
				clinicId: actor.clinicId,
				cashierId: actor.userId,
				openingCash: new Prisma.Decimal(input.openingCash),
			});
			await this.audit.created(tx, {
				...this.auditBase(actor, row.id),
				event: 'cashier_shift.open',
				changes: { after: { openingCash: row.openingCash.toFixed(2) } },
			});
			this.logger.log(`Opened shift ${row.id}`);
			return toCashierShift(row, []);
		});
	}

	/** The user's open shift at the clinic with its running totals, or null. */
	current(actor: BillingActor): Promise<CashierShift | null> {
		return this.db.asUser(actor.userId, async (tx) => {
			const row = await this.shifts.findOpen(tx, actor.clinicId, actor.userId);
			return row ? toCashierShift(row, await this.shifts.methodTotals(tx, row.id)) : null;
		});
	}

	/** The X reading: the shift's summary by method, mid-shift; it stays open. */
	xReading(actor: BillingActor, shiftId: string): Promise<CashierShift> {
		return this.db.asUser(actor.userId, async (tx) => {
			const row = await this.ownShift(tx, actor, shiftId);
			const reading = toCashierShift(row, await this.shifts.methodTotals(tx, row.id));
			await this.audit.view(tx, {
				...this.auditBase(actor, row.id),
				event: 'cashier_shift.x_reading',
				changes: { after: { totalCollected: reading.totalCollected, expectedCash: reading.expectedCash } },
			});
			return reading;
		});
	}

	/** The Z reading: counts the cash, stores expected cash and the variance, and closes the shift. */
	async close(actor: BillingActor, input: CloseCashierShiftInput): Promise<CashierShift> {
		const denominations = countByDenomination(input.denominations);
		return this.db.asUser(actor.userId, async (tx) => {
			const row = await this.ownShift(tx, actor, input.shiftId);
			if (row.closedAt) {
				throw new ShiftClosedError(row.id);
			}
			// Wait for a payment being taken on this shift to finish, then count.
			await this.shifts.lock(tx, row.id);
			const totals = await this.shifts.methodTotals(tx, row.id);
			const cash = totals
				.filter((total) => total.method === 'CASH' && total.status === 'POSTED')
				.reduce((sum, total) => sum.plus(total.amount), ZERO);
			const expectedCash = row.openingCash.plus(cash);
			const countedCash = Object.entries(denominations).reduce(
				(sum, [denomination, count]) => sum.plus(new Prisma.Decimal(denomination).times(count)),
				ZERO,
			);
			const variance = countedCash.minus(expectedCash);
			const closed = await this.shifts.close(tx, row.id, {
				closedAt: new Date(),
				closedById: actor.userId,
				expectedCash,
				countedCash,
				variance,
				denominations,
				remarks: input.remarks?.trim() || null,
			});
			if (!closed) {
				throw new ShiftClosedError(row.id);
			}
			await this.audit.updated(tx, {
				...this.auditBase(actor, row.id),
				event: 'cashier_shift.z_reading',
				reason: closed.remarks,
				changes: {
					before: { closedAt: null },
					after: {
						expectedCash: expectedCash.toFixed(2),
						countedCash: countedCash.toFixed(2),
						variance: variance.toFixed(2),
					},
				},
			});
			this.logger.log(`Closed shift ${row.id}, variance ${variance.toFixed(2)}`);
			return toCashierShift(closed, totals);
		});
	}

	/** The clinic's shifts of a period (admins: everyone's; a cashier: their own). */
	async list(actor: BillingActor, input: CashierShiftsInput): Promise<CashierShift[]> {
		const range = manilaDayRange(input.from, input.to ?? input.from);
		return this.db.asUser(actor.userId, async (tx) => {
			const rows = await this.shifts.list(tx, {
				clinicId: actor.clinicId,
				from: range.gte,
				to: range.lt,
				cashierId: isBillingAdmin(actor) ? null : actor.userId,
			});
			const shifts: CashierShift[] = [];
			for (const row of rows) {
				shifts.push(toCashierShift(row, await this.shifts.methodTotals(tx, row.id)));
			}
			return shifts;
		});
	}

	/**
	 * The user's open shift at the clinic, locked for the payment being taken (the Z reading waits for it); refused
	 * without one. Inside the payment's transaction.
	 */
	async requireOpenShift(tx: ClinicalTx, actor: BillingActor): Promise<string> {
		const shift = await this.shifts.findOpen(tx, actor.clinicId, actor.userId);
		if (!shift) {
			throw new NoOpenShiftError();
		}
		const locked = await this.shifts.lock(tx, shift.id);
		if (!locked || locked.closedAt) {
			throw new NoOpenShiftError();
		}
		return shift.id;
	}

	/** Whether the payment's shift is still open (a payment of a closed shift is not voided). */
	async isOpen(tx: ClinicalTx, shiftId: string): Promise<boolean> {
		const row = await this.shifts.findById(tx, shiftId);
		return Boolean(row && !row.closedAt);
	}

	private async ownShift(tx: ClinicalTx, actor: BillingActor, shiftId: string): Promise<CashierShiftRow> {
		const row = await this.shifts.findById(tx, shiftId);
		if (!row || row.clinicId !== actor.clinicId) {
			throw new EntityNotFoundError('CashierShift', shiftId);
		}
		if (row.cashierId !== actor.userId && !isBillingAdmin(actor)) {
			throw new ShiftNotYoursError();
		}
		return row;
	}

	private auditBase(actor: BillingActor, shiftId: string) {
		return { userId: actor.userId, entityType: 'CashierShift', entityId: shiftId, clinicId: actor.clinicId };
	}
}

/** The count per bill / coin, keyed by the peso value; refuses a denomination that isn't Philippine money. */
function countByDenomination(rows: readonly { denomination: number; count: number }[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const row of rows) {
		if (!(CASH_DENOMINATIONS as readonly number[]).includes(row.denomination)) {
			throw new InvalidBillingInputError(`₱${row.denomination} is not a peso bill or coin.`, 'denominations');
		}
		const key = String(row.denomination);
		counts[key] = (counts[key] ?? 0) + row.count;
	}
	return counts;
}
