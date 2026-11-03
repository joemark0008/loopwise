import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	AcceptOrderDocument,
	CancelOrderDocument,
	LabOrderCountsDocument,
	LabOrdersDocument,
	MarkOrderCollectedDocument,
	RejectOrderDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['order'];
type Outputs = ApiOutputs['order'];

/** Orders (`apps/api/src/clinical/orders`): the receiving facility's worklist and its steps, and cancelling an order. */
export const ordersApi = {
	order: {
		labOrders: query<Inputs['labOrders'], Outputs['labOrders']>(
			['order', 'lab'],
			async ({ status }) => (await runQuery(LabOrdersDocument, { status })).labOrders,
		),
		/** Under `['order', 'lab']`, so every worklist step refreshes the tab counts too. */
		labOrderCounts: query<Inputs['labOrderCounts'], Outputs['labOrderCounts']>(
			['order', 'lab', 'counts'],
			async () => (await runQuery(LabOrderCountsDocument, {})).labOrderCounts,
		),
		accept: mutation<Inputs['accept'], Outputs['accept']>(
			['order', 'accept'],
			async ({ orderId }) => (await runMutation(AcceptOrderDocument, { orderId })).acceptOrder,
		),
		markCollected: mutation<Inputs['markCollected'], Outputs['markCollected']>(
			['order', 'markCollected'],
			async ({ orderId }) => (await runMutation(MarkOrderCollectedDocument, { orderId })).markOrderCollected,
		),
		reject: mutation<Inputs['reject'], Outputs['reject']>(
			['order', 'reject'],
			async (input) => (await runMutation(RejectOrderDocument, { input })).rejectOrder,
		),
		cancel: mutation<Inputs['cancel'], Outputs['cancel']>(
			['order', 'cancel'],
			async (input) => (await runMutation(CancelOrderDocument, { input })).cancelOrder,
		),
	},
};
