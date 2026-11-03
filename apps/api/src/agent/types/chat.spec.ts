import { MAX_IMAGE_SIZE_MB } from '@quarry/shared/attachments';
import { describe, expect, it } from 'vitest';

import { AgentRequestSchema, AgentRequestUserMessageSchema } from './chat.js';

describe('AgentRequestUserMessageSchema', () => {
	it('enforces the decoded image size limit on the server schema', () => {
		const oversized = Buffer.alloc(MAX_IMAGE_SIZE_MB * 1024 * 1024 + 1).toString('base64');
		const parsed = AgentRequestUserMessageSchema.safeParse({
			text: '',
			images: [{ mediaType: 'image/png', data: oversized }],
		});

		expect(parsed.success).toBe(false);
	});
});

describe('agent chat modes', () => {
	it('accepts explicit example chat requests', () => {
		const request = AgentRequestSchema.parse({ message: { text: 'Show me revenue' }, mode: 'example' });
		expect(request.mode).toBe('example');
	});

	// Upstream's `getChatModeMismatchError` (services/agent-run.ts) is not ported: onboarding chats are not in quarry yet.
});

describe('AgentRequestSchema query workbench', () => {
	const message = { text: 'Top customers' };
	const workbench = { sql: 'SELECT 1', databaseId: null };

	it('accepts the editor context in query_workbench mode', () => {
		const request = AgentRequestSchema.parse({ message, mode: 'query_workbench', workbench });
		expect(request.workbench).toEqual(workbench);
	});

	it('rejects the editor context in other modes', () => {
		expect(AgentRequestSchema.safeParse({ message, workbench }).success).toBe(false);
		expect(AgentRequestSchema.safeParse({ message, mode: 'onboarding', workbench }).success).toBe(false);
	});

	it('rejects an oversized editor', () => {
		const sql = 'x'.repeat(64_001);
		const parsed = AgentRequestSchema.safeParse({
			message,
			mode: 'query_workbench',
			workbench: { sql, databaseId: null },
		});
		expect(parsed.success).toBe(false);
	});
});
