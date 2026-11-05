import { Injectable } from '@nestjs/common';

export interface ShareRecipients {
	userIds?: string[];
	groupIds?: string[];
}

/**
 * Stand-in for upstream `services/clinic-sharing.service.ts` until user groups (Phase 6): without custom
 * groups upstream lets every member share with the whole clinic and with any member, so both checks pass.
 */
@Injectable()
export class ClinicSharingService {
	async assertCanShareToClinic(_projectId: string, _userId: string): Promise<void> {}

	async assertCanShareWith(_projectId: string, _userId: string, _recipients: ShareRecipients): Promise<void> {}
}
