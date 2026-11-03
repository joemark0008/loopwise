import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentService } from '../agent/agent.service.js';
import type { ChatRepository } from './chat.repository.js';
import type { ChatAccessService } from './chat-access.service.js';
import { QueryRowsService } from './query-rows.service.js';

const getQueryToolOutputInChat = vi.fn();
const agentService = { get: vi.fn() };
const service = new QueryRowsService(
	{ getQueryToolOutputInChat } as unknown as ChatRepository,
	{} as ChatAccessService,
	agentService as unknown as AgentService,
);
const getQueryRowsPage = (request: Parameters<QueryRowsService['getQueryRowsPage']>[0]) =>
	service.getQueryRowsPage(request);

const ROWS = [{ amount: 30 }, { amount: 10 }, { amount: 50 }, { amount: 20 }, { amount: 40 }];
const REQUEST = { chatId: 'chat-1', toolCallId: 'call-1', queryId: 'query_abc', offset: 0 };

describe('getQueryRowsPage', () => {
	beforeEach(() => {
		getQueryToolOutputInChat.mockReset();
		agentService.get.mockReset();
	});

	it('returns a page of the persisted result', async () => {
		mockPersistedRows(ROWS);

		const page = await getQueryRowsPage({ ...REQUEST, offset: 2, limit: 2 });

		expect(page).toEqual({ columns: ['amount'], rows: [{ amount: 50 }, { amount: 20 }], totalRows: 5 });
		expect(getQueryToolOutputInChat).toHaveBeenCalledWith('chat-1', 'call-1');
	});

	it('sorts every row before slicing the page', async () => {
		mockPersistedRows(ROWS);

		const page = await getQueryRowsPage({ ...REQUEST, limit: 2, sort: { column: 'amount', direction: 'desc' } });

		expect(page?.rows).toEqual([{ amount: 50 }, { amount: 40 }]);
	});

	it('returns every row from the offset when no limit is given', async () => {
		mockPersistedRows(ROWS);

		const page = await getQueryRowsPage({ ...REQUEST, offset: 1 });

		expect(page?.rows).toEqual(ROWS.slice(1));
	});

	it('falls back to the running agent for a query of the current turn', async () => {
		getQueryToolOutputInChat.mockResolvedValue(null);
		const getQueryResult = vi.fn().mockReturnValue({ columns: ['amount'], data: ROWS });
		agentService.get.mockReturnValue({ getQueryResult });

		const page = await getQueryRowsPage({ ...REQUEST, limit: 1 });

		expect(getQueryResult).toHaveBeenCalledWith('query_abc');
		expect(page).toEqual({ columns: ['amount'], rows: [{ amount: 30 }], totalRows: 5 });
	});

	it('ignores a persisted part holding another query', async () => {
		mockPersistedRows(ROWS);
		agentService.get.mockReturnValue(undefined);

		expect(await getQueryRowsPage({ ...REQUEST, queryId: 'query_other' })).toBeNull();
	});

	it('returns null when the query is nowhere to be found', async () => {
		getQueryToolOutputInChat.mockResolvedValue(null);
		agentService.get.mockReturnValue(undefined);

		expect(await getQueryRowsPage(REQUEST)).toBeNull();
	});
});

function mockPersistedRows(rows: Record<string, unknown>[]) {
	getQueryToolOutputInChat.mockResolvedValue({
		_version: '1',
		data: rows,
		row_count: rows.length,
		columns: ['amount'],
		id: 'query_abc',
	});
}
