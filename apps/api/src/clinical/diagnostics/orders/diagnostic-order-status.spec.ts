import { describe, expect, it } from 'vitest';

import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import type { DiagnosticOrderStatus } from '../../../generated/prisma/enums.js';
import {
	assertTransition,
	CANCELLABLE_STATUSES,
	canTransition,
	deriveOrderStatus,
	DIAGNOSTIC_ORDER_TRANSITIONS,
	transitionPath,
} from './diagnostic-order-status.js';

const ALL = Object.keys(DIAGNOSTIC_ORDER_TRANSITIONS) as DiagnosticOrderStatus[];

/** The edges of `check_diagnostic_order_transition` (migration 0001), written out as the trigger has them. */
const TRIGGER_EDGES = new Set([
	'REQUESTED>PAID',
	'REQUESTED>SPECIMEN_COLLECTED',
	'REQUESTED>IN_PROGRESS',
	'REQUESTED>RESULTED',
	'REQUESTED>CANCELLED',
	'PAID>SPECIMEN_COLLECTED',
	'PAID>IN_PROGRESS',
	'PAID>RESULTED',
	'PAID>CANCELLED',
	'SPECIMEN_COLLECTED>IN_PROGRESS',
	'SPECIMEN_COLLECTED>RESULTED',
	'SPECIMEN_COLLECTED>CANCELLED',
	'IN_PROGRESS>RESULTED',
	'IN_PROGRESS>CANCELLED',
	'RESULTED>RELEASED',
	'RESULTED>IN_PROGRESS',
	'RELEASED>IN_PROGRESS',
]);

describe('diagnostic order status', () => {
	it('allows exactly the moves the database trigger allows', () => {
		for (const from of ALL) {
			for (const to of ALL) {
				expect(canTransition(from, to), `${from} → ${to}`).toBe(TRIGGER_EDGES.has(`${from}>${to}`));
			}
		}
	});

	it('refuses a move with the domain error', () => {
		expect(() => assertTransition('DiagnosticOrderItem', 'RELEASED', 'CANCELLED')).toThrow(
			InvalidStatusTransitionError,
		);
		expect(() => assertTransition('DiagnosticOrderItem', 'RESULTED', 'RELEASED')).not.toThrow();
	});

	it('cancels only before the result', () => {
		expect([...CANCELLABLE_STATUSES].sort()).toEqual(['IN_PROGRESS', 'PAID', 'REQUESTED', 'SPECIMEN_COLLECTED']);
	});

	it('finds the chain of moves the header takes to follow its tests', () => {
		expect(transitionPath('REQUESTED', 'REQUESTED')).toEqual([]);
		expect(transitionPath('REQUESTED', 'RESULTED')).toEqual(['RESULTED']);
		expect(transitionPath('REQUESTED', 'RELEASED')).toEqual(['RESULTED', 'RELEASED']);
		expect(transitionPath('RELEASED', 'RESULTED')).toEqual(['IN_PROGRESS', 'RESULTED']);
		expect(transitionPath('CANCELLED', 'REQUESTED')).toBeNull();
		expect(transitionPath('RESULTED', 'SPECIMEN_COLLECTED')).toBeNull();
	});

	it('derives the header from the least advanced live test', () => {
		expect(deriveOrderStatus(['RESULTED', 'SPECIMEN_COLLECTED'])).toBe('SPECIMEN_COLLECTED');
		expect(deriveOrderStatus(['RELEASED', 'CANCELLED'])).toBe('RELEASED');
		expect(deriveOrderStatus(['RELEASED', 'RELEASED'])).toBe('RELEASED');
		expect(deriveOrderStatus(['CANCELLED', 'CANCELLED'])).toBe('CANCELLED');
		expect(deriveOrderStatus(['RELEASED', 'IN_PROGRESS'])).toBe('IN_PROGRESS');
		expect(deriveOrderStatus([])).toBe('CANCELLED');
	});
});
