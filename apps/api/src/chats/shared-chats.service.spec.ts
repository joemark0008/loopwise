import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HandlerError } from '../common/errors/handler-error.js';
import type { ProjectRepository } from '../projects/project.repository.js';
import type { ChatRepository } from './chat.repository.js';
import type { ChatsService } from './chats.service.js';
import type { ProjectSharingService } from './project-sharing.service.js';
import type { SharedChatRepository } from './shared-chat.repository.js';
import { SharedChatsService } from './shared-chats.service.js';

/** Port of upstream `tests/shared-chat.routes.test.ts`, against the service behind the GraphQL resolver. */
const mocks = {
	getChatInfo: vi.fn(),
	getChatOwnerId: vi.fn(),
	getUserRoleInProject: vi.fn(),
	listUsersWithProjectAccess: vi.fn(),
	createSharedChat: vi.fn(),
	getSharedChatInfo: vi.fn(),
	getShareAllowedUserIds: vi.fn(),
	updateSharedChatAllowedUsers: vi.fn(),
	assertCanShareToProject: vi.fn(),
	assertCanShareWith: vi.fn(),
};

const service = new SharedChatsService(
	{ getChatInfo: mocks.getChatInfo, getChatOwnerId: mocks.getChatOwnerId } as unknown as ChatRepository,
	{
		createSharedChat: mocks.createSharedChat,
		getSharedChatInfo: mocks.getSharedChatInfo,
		getShareAllowedUserIds: mocks.getShareAllowedUserIds,
		updateSharedChatAllowedUsers: mocks.updateSharedChatAllowedUsers,
	} as unknown as SharedChatRepository,
	{
		getUserRoleInProject: mocks.getUserRoleInProject,
		listUsersWithProjectAccess: mocks.listUsersWithProjectAccess,
	} as unknown as ProjectRepository,
	{
		assertCanShareToProject: mocks.assertCanShareToProject,
		assertCanShareWith: mocks.assertCanShareWith,
	} as unknown as ProjectSharingService,
	{} as ChatsService,
);

/** The selected project is `project-1`, as upstream's caller; the role comes from `getUserRoleInProject`. */
async function create(
	userId: string,
	input: { chatId: string; visibility?: 'project' | 'specific'; allowedUserIds?: string[] },
) {
	const userRole = await mocks.getUserRoleInProject('project-1', userId);
	return service.create({ projectId: 'project-1', userId, userRole }, { visibility: 'project', ...input });
}

describe('sharedChat.create', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getChatInfo.mockResolvedValue({ projectId: 'project-1', userId: 'owner-1', title: 'Private chat' });
		mocks.createSharedChat.mockResolvedValue({ id: 'share-1' });
		mocks.assertCanShareToProject.mockResolvedValue(undefined);
		mocks.assertCanShareWith.mockResolvedValue(undefined);
	});

	it("refuses a member sharing another member's chat", async () => {
		mocks.getUserRoleInProject.mockResolvedValue('user');

		await expect(create('member-1', { chatId: 'chat-1' })).rejects.toMatchObject({ codeMessage: 'FORBIDDEN' });
		expect(mocks.createSharedChat).not.toHaveBeenCalled();
	});

	it('lets the owner share their chat', async () => {
		mocks.getUserRoleInProject.mockResolvedValue('user');

		await expect(create('owner-1', { chatId: 'chat-1' })).resolves.toEqual({ id: 'share-1' });
	});

	it("lets a project admin share another member's chat", async () => {
		mocks.getUserRoleInProject.mockResolvedValue('admin');

		await expect(create('admin-1', { chatId: 'chat-1' })).resolves.toEqual({ id: 'share-1' });
	});

	it('refuses to share with the entire project when the user group does not allow it', async () => {
		mocks.getUserRoleInProject.mockResolvedValue('user');
		mocks.assertCanShareToProject.mockRejectedValue(new HandlerError('FORBIDDEN', 'Not allowed.'));

		await expect(create('owner-1', { chatId: 'chat-1', visibility: 'project' })).rejects.toMatchObject({
			codeMessage: 'FORBIDDEN',
		});
		expect(mocks.assertCanShareToProject).toHaveBeenCalledWith('project-1', 'owner-1');
		expect(mocks.createSharedChat).not.toHaveBeenCalled();
	});

	it('checks specific recipients against what the owner may share with', async () => {
		mocks.getUserRoleInProject.mockResolvedValue('user');
		mocks.assertCanShareWith.mockRejectedValue(new HandlerError('FORBIDDEN', 'Not allowed.'));

		await expect(
			create('owner-1', { chatId: 'chat-1', visibility: 'specific', allowedUserIds: ['outsider-1'] }),
		).rejects.toMatchObject({ codeMessage: 'FORBIDDEN' });
		expect(mocks.assertCanShareWith).toHaveBeenCalledWith('project-1', 'owner-1', { userIds: ['outsider-1'] });
		expect(mocks.assertCanShareToProject).not.toHaveBeenCalled();
		expect(mocks.createSharedChat).not.toHaveBeenCalled();
	});
});

describe('sharedChat.updateAccess', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getUserRoleInProject.mockResolvedValue('user');
		mocks.getSharedChatInfo.mockResolvedValue({
			id: 'share-1',
			chatId: 'chat-1',
			projectId: 'project-1',
			visibility: 'specific',
			title: 'Chat',
		});
		mocks.getChatOwnerId.mockResolvedValue('owner-1');
		mocks.getShareAllowedUserIds.mockResolvedValue(['member-1', 'member-2']);
		mocks.listUsersWithProjectAccess.mockResolvedValue([{ id: 'member-1' }, { id: 'member-2' }]);
		mocks.assertCanShareWith.mockResolvedValue(undefined);
	});

	it('refuses to add a recipient the owner may not share with', async () => {
		mocks.assertCanShareWith.mockRejectedValue(new HandlerError('FORBIDDEN', 'Not allowed.'));

		await expect(service.updateAccess('share-1', 'owner-1', ['member-1', 'outsider-1'])).rejects.toMatchObject({
			codeMessage: 'FORBIDDEN',
		});
		expect(mocks.assertCanShareWith).toHaveBeenCalledWith('project-1', 'owner-1', { userIds: ['outsider-1'] });
		expect(mocks.updateSharedChatAllowedUsers).not.toHaveBeenCalled();
	});

	it('only checks newly added recipients, so removing people is always allowed', async () => {
		await service.updateAccess('share-1', 'owner-1', ['member-1']);

		expect(mocks.assertCanShareWith).toHaveBeenCalledWith('project-1', 'owner-1', { userIds: [] });
		expect(mocks.updateSharedChatAllowedUsers).toHaveBeenCalledWith('share-1', ['member-1']);
	});
});
