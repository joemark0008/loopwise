import { field, type Hl7Message } from './hl7-parser.js';
import { controlIdOf, messageTypeOf } from './oru-mapper.js';

/** Inbound order messages a lab system sends about our orders (DESIGN.md §11): status updates, not results. */
export const ORDER_STATUS_MESSAGE_TYPES = ['ORM^O01', 'OML^O21', 'ORR^O02', 'ORL^O22'] as const;

export interface OrderStatusUpdate {
	/** ORC-2: our `ClinicalOrder.id`. */
	placerOrderId: string;
	/** ORC-1, e.g. `SC` (status changed), `OK` (accepted), `UA` / `OC` (refused, cancelled). */
	orderControl: string;
	/** ORC-5, e.g. `IP` (in process), `CM` (specimen collected). */
	orderStatus: string | null;
}

export interface NormalizedOrderStatus {
	controlId: string;
	messageType: string;
	updates: OrderStatusUpdate[];
}

export function isOrderStatusMessage(messageType: string): boolean {
	return (ORDER_STATUS_MESSAGE_TYPES as readonly string[]).includes(messageType);
}

/** One update per ORC segment that names an order (ORC-2) and an order control (ORC-1). */
export function mapOrderStatus(message: Hl7Message): NormalizedOrderStatus {
	const updates = message.segments
		.filter((segment) => segment.name === 'ORC')
		.map((orc) => ({
			placerOrderId: field(orc, 2).trim(),
			orderControl: field(orc, 1).trim().toUpperCase(),
			orderStatus: field(orc, 5).trim().toUpperCase() || null,
		}))
		.filter((update) => update.placerOrderId && update.orderControl);
	return { controlId: controlIdOf(message), messageType: messageTypeOf(message), updates };
}
