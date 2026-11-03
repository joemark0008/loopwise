import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getChartOwnerInfo: vi.fn(),
	getDisplayConfigByToolCallId: vi.fn(),
	getExecuteSqlPartByQueryIdInChat: vi.fn(),
	canUserViewChatContent: vi.fn(),
	generateChartImage: vi.fn(),
	getImageById: vi.fn(),
	listChatsReferencingImage: vi.fn(),
}));

vi.mock('./components/generate-chart.js', () => ({ generateChartImage: mocks.generateChartImage }));

import type { ChatRepository } from '../chats/chat.repository.js';
import type { ChatAccessService } from '../chats/chat-access.service.js';
import type { ProjectRepository } from '../projects/project.repository.js';
import type { ChartRepository } from './chart.repository.js';
import { ChartsService } from './charts.service.js';

const CALLER_ID = 'attacker-id';
const CHART_CONFIG = {
	chart_type: 'bar',
	query_id: 'query-1',
	x_axis_key: 'month',
	series: [{ data_key: 'revenue' }],
	title: 'Revenue',
};

const service = new ChartsService(
	{
		getChartOwnerInfo: mocks.getChartOwnerInfo,
		getDisplayConfigByToolCallId: mocks.getDisplayConfigByToolCallId,
		getImageById: mocks.getImageById,
		listChatsReferencingImage: mocks.listChatsReferencingImage,
	} as unknown as ChartRepository,
	{ getExecuteSqlPartByQueryIdInChat: mocks.getExecuteSqlPartByQueryIdInChat } as unknown as ChatRepository,
	{ getDisplaySettings: vi.fn(async () => ({ dateFormat: 'YYYY-MM-DD' })) } as unknown as ProjectRepository,
	{ canUserViewChatContent: mocks.canUserViewChatContent } as unknown as ChatAccessService,
);

/** Port of upstream `tests/chart-download.routes.test.ts`. */
describe('chart.download', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getChartOwnerInfo.mockResolvedValue({
			projectId: 'victim-project',
			userId: 'victim',
			chatId: 'victim-chat',
		});
		mocks.getDisplayConfigByToolCallId.mockResolvedValue(CHART_CONFIG);
		mocks.getExecuteSqlPartByQueryIdInChat.mockResolvedValue({
			toolOutput: { data: [{ month: 'Jan', revenue: 1 }] },
		});
		mocks.generateChartImage.mockReturnValue(Buffer.from('png'));
	});

	it("refuses a chart from a chat the caller can't open", async () => {
		mocks.canUserViewChatContent.mockResolvedValue(false);

		await expect(service.downloadChart('victim-tool-call', CALLER_ID)).rejects.toMatchObject({
			codeMessage: 'NOT_FOUND',
		});
		expect(mocks.canUserViewChatContent).toHaveBeenCalledWith('victim-chat', 'victim-project', CALLER_ID);
		expect(mocks.getExecuteSqlPartByQueryIdInChat).not.toHaveBeenCalled();
		expect(mocks.generateChartImage).not.toHaveBeenCalled();
	});

	it("refuses a chart whose query isn't in the chart's own chat", async () => {
		mocks.canUserViewChatContent.mockResolvedValue(true);
		mocks.getExecuteSqlPartByQueryIdInChat.mockResolvedValue(null);

		await expect(service.downloadChart('own-tool-call', CALLER_ID)).rejects.toMatchObject({
			codeMessage: 'NOT_FOUND',
		});
		expect(mocks.getExecuteSqlPartByQueryIdInChat).toHaveBeenCalledWith('victim-chat', 'query-1');
		expect(mocks.generateChartImage).not.toHaveBeenCalled();
	});

	it('renders a chart the caller can view from its own chat data', async () => {
		mocks.canUserViewChatContent.mockResolvedValue(true);

		await expect(service.downloadChart('own-tool-call', CALLER_ID)).resolves.toBe(
			Buffer.from('png').toString('base64'),
		);
		expect(mocks.generateChartImage).toHaveBeenCalledWith(
			expect.objectContaining({ data: [{ month: 'Jan', revenue: 1 }] }),
		);
	});
});

const IMAGE_ID = '6f1d1f0e-8a0e-4a59-9f0b-6a5c2d7a9e11';

/**
 * Port of upstream `tests/image.routes.test.ts`. The anonymous case is the global `AuthGuard`'s, covered in
 * `test/charts.e2e-spec.ts`.
 */
describe('GET /i/:imageId', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.listChatsReferencingImage.mockResolvedValue([{ chatId: 'chat-1', projectId: 'project-1' }]);
		mocks.getImageById.mockResolvedValue({ mediaType: 'image/png', data: Buffer.from('png').toString('base64') });
	});

	it("refuses a signed-in user who can't open any chat holding the image", async () => {
		mocks.canUserViewChatContent.mockResolvedValue(false);

		await expect(service.getImageForUser(IMAGE_ID, 'viewer-id')).rejects.toMatchObject({ code: 404 });
		expect(mocks.canUserViewChatContent).toHaveBeenCalledWith('chat-1', 'project-1', 'viewer-id');
		expect(mocks.getImageById).not.toHaveBeenCalled();
	});

	it('serves the image to a user who can open the chat', async () => {
		mocks.canUserViewChatContent.mockResolvedValue(true);

		const image = await service.getImageForUser(IMAGE_ID, 'viewer-id');
		expect(image.mediaType).toBe('image/png');
		expect(image.buffer.toString()).toBe('png');
	});

	it('rejects an image id that is not a uuid', async () => {
		await expect(service.getImageForUser('not-a-uuid', 'viewer-id')).rejects.toMatchObject({ code: 400 });
		expect(mocks.listChatsReferencingImage).not.toHaveBeenCalled();
	});
});
