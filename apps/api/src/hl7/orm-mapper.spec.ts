import { describe, expect, it } from 'vitest';

import { parseHl7 } from './hl7-parser.js';
import { isOrderStatusMessage, mapOrderStatus } from './orm-mapper.js';

describe('mapOrderStatus', () => {
	it('reads ORC-1, ORC-2 and ORC-5 of every ORC', () => {
		const message = parseHl7(
			[
				'MSH|^~\\&|BDL-LIS|BOHOL-DIAGNOSTICS|LOOPWISE|HUB|20261106093000||ORM^O01|ST-1|P|2.5.1',
				'PID|1||THC-0001^^^THC^MR',
				'ORC|sc|order-1|ACC-1||cm',
				'ORC|OK|order-2',
				'ORC|SC||ACC-3||IP',
			].join('\r'),
		);
		expect(mapOrderStatus(message)).toEqual({
			controlId: 'ST-1',
			messageType: 'ORM^O01',
			updates: [
				{ placerOrderId: 'order-1', orderControl: 'SC', orderStatus: 'CM' },
				{ placerOrderId: 'order-2', orderControl: 'OK', orderStatus: null },
			],
		});
	});

	it('knows which message types carry order status', () => {
		expect(['ORM^O01', 'OML^O21', 'ORR^O02', 'ORL^O22'].every(isOrderStatusMessage)).toBe(true);
		expect(isOrderStatusMessage('ORU^R01')).toBe(false);
		expect(isOrderStatusMessage('ADT^A01')).toBe(false);
	});
});
