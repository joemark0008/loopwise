import { documentMediaType, toSafeFileName } from '@loopwise/shared/attachments';
import type { UserRole } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import { isStoragePath, toStorageRelativePath, toStorageVirtualPath } from '../agent/utils/tools.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { ProjectRepository } from '../projects/project.repository.js';
import { readAttachmentText } from './attachment-text.js';
import {
	getStorageConfig,
	getStorageHealth,
	getStorageMaxFileSizeMb,
	isStorageEnabled,
	relativePathFromKey,
	STORAGE_DISABLED_MESSAGE,
	type StorageScope,
} from './storage/index.js';
import { getProjectUsageByUser, getScopeUsage } from './storage/usage.js';
import { readUserFileBytes, saveUploadedFile, statUserFile } from './storage/user-files.js';

export interface UploadedFile {
	/** The name the browser reported. */
	originalname: string;
	buffer: Buffer;
	size: number;
}

export interface UploadedAttachment {
	path: string;
	filename: string;
	mediaType: string | undefined;
	size: number;
}

export interface AttachmentFile {
	fileName: string;
	mediaType: string;
	size: number;
	/** The bytes, unless only the metadata was asked for (`HEAD`). */
	data?: Buffer;
}

/**
 * Port of upstream `routes/attachment.ts` (the upload and download handlers) and `trpc/storage.routes.ts`. Files a
 * user attaches to a message are uploaded first, so only their path travels with the message; they land in the
 * sender's own permanent storage space.
 */
@Injectable()
export class AttachmentsService {
	constructor(private readonly projects: ProjectRepository) {}

	/** `POST /api/attachments`. */
	async upload(
		userId: string,
		projectId: string,
		userRole: UserRole,
		file: UploadedFile | undefined,
	): Promise<UploadedAttachment> {
		if (!isStorageEnabled()) {
			throw new HandlerError('BAD_REQUEST', STORAGE_DISABLED_MESSAGE);
		}
		if (userRole === 'viewer') {
			throw new HandlerError('FORBIDDEN', 'Viewers cannot upload files');
		}
		if (!file) {
			throw new HandlerError('BAD_REQUEST', 'No file uploaded');
		}

		const maxFileSizeMb = getStorageMaxFileSizeMb();
		if (file.size > maxFileSizeMb * 1024 * 1024) {
			throw new HandlerError(
				'BAD_REQUEST',
				`${file.originalname} is larger than the ${maxFileSizeMb} MB upload limit`,
			);
		}

		const safeName = toSafeFileName(file.originalname);
		if (!safeName || !documentMediaType(safeName)) {
			throw new HandlerError('BAD_REQUEST', `${file.originalname} is not a file type Loopwise accepts`);
		}

		const scope: StorageScope = { projectId, userId };
		const stored = await saveUploadedFile(scope, safeName, file.buffer);
		const relativePath = relativePathFromKey(scope, stored.key);

		return {
			path: toStorageVirtualPath(relativePath),
			filename: fileNameOf(relativePath),
			mediaType: stored.contentType,
			size: stored.size,
		};
	}

	/**
	 * `GET|HEAD /api/attachments/file`: the bytes behind an attachment, so the app can preview one it cannot parse
	 * from the message alone. Only the sender's own space is reachable, which is also the only space a chat's
	 * attachments live in.
	 */
	async getFile(userId: string, projectId: string, path: string, withData: boolean): Promise<AttachmentFile> {
		if (!isStorageEnabled()) {
			throw new HandlerError('BAD_REQUEST', STORAGE_DISABLED_MESSAGE);
		}
		if (!path) {
			throw new HandlerError('BAD_REQUEST', 'path is required');
		}

		const relativePath = isStoragePath(path) ? toStorageRelativePath(path) : '';
		if (!relativePath) {
			throw new HandlerError('BAD_REQUEST', `${path} is not a path in permanent storage`);
		}

		const scope: StorageScope = { projectId, userId };
		const stored = await statUserFile(scope, relativePath);
		if (!stored) {
			throw new HandlerError('NOT_FOUND', `No such file in permanent storage: ${path}`);
		}

		const fileName = fileNameOf(relativePath);
		return {
			fileName,
			mediaType: documentMediaType(fileName) ?? 'application/octet-stream',
			size: stored.size,
			...(withData && { data: await readUserFileBytes(scope, relativePath) }),
		};
	}

	/**
	 * Wise's `read_attachment` (DESIGN.md §9.2): the readable text of a file in the user's own space, with OCR for
	 * scanned PDF pages. The scope is the run's user and project, never something the model chose.
	 */
	async readTextForWise(userId: string, projectId: string, relativePath: string): Promise<string> {
		if (!isStorageEnabled()) {
			throw new Error(STORAGE_DISABLED_MESSAGE);
		}
		return readAttachmentText({ projectId, userId }, relativePath);
	}

	/** `storage.getConfig`. */
	getConfig() {
		return getStorageConfig();
	}

	/** `storage.getHealth`. */
	async getHealth() {
		const health = await getStorageHealth();
		return { ...health, checkedAt: new Date() };
	}

	/** `storage.getUploadLimits`: what the chat input needs to know before letting someone attach a file. */
	getUploadLimits() {
		return { enabled: isStorageEnabled(), maxFileSizeMb: getStorageMaxFileSizeMb() };
	}

	/** `storage.getUsage`: everyone sees their own space; admins also get the breakdown across the project. */
	async getUsage(projectId: string, userId: string, userRole: UserRole) {
		const own = await getScopeUsage({ projectId, userId });
		return {
			own,
			byUser: userRole === 'admin' ? await this.getNamedUsageByUser(projectId) : null,
		};
	}

	/** Files outlive membership, so a space whose owner left is labelled by its user id. */
	private async getNamedUsageByUser(projectId: string) {
		const [usageByUser, members] = await Promise.all([
			getProjectUsageByUser(projectId),
			this.projects.listUsersWithProjectAccess(projectId),
		]);
		const nameByUserId = new Map(members.map((member) => [member.id, member.name || member.email]));

		return usageByUser.map((usage) => ({ ...usage, name: nameByUserId.get(usage.userId) ?? usage.userId }));
	}
}

const fileNameOf = (relativePath: string): string => {
	return relativePath.slice(relativePath.lastIndexOf('/') + 1);
};
