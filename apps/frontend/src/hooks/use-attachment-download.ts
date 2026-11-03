import { useMutation } from '@tanstack/react-query';

import { downloadAttachment } from '@/lib/attachments';

/** Saves a file out of permanent storage. Download analytics come back with Phase 6. */
export function useAttachmentDownload(path: string) {
	return useMutation({
		mutationFn: () => downloadAttachment(path),
	});
}
