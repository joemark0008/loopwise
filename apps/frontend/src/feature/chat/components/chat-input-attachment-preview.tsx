import { AlertTriangle, Loader2, X } from 'lucide-react';

import { AttachmentFileIcon } from './attachment-file-icon';
import styles from './chat-input-attachment-preview.module.css';
import type { Attachment } from '@/hooks/use-attachment-upload';
import { cn, formatBytes } from '@/lib/utils';

interface ChatInputAttachmentPreviewProps {
	attachments: Attachment[];
	rejection?: string;
	onRemove: (id: string) => void;
}

export function ChatInputAttachmentPreview({ attachments, rejection, onRemove }: ChatInputAttachmentPreviewProps) {
	const isVisible = attachments.length > 0 || !!rejection;

	return (
		<div className={styles.chatInputAttachmentPreviewDiv} style={{ gridTemplateRows: isVisible ? '1fr' : '0fr' }}>
			<div className={styles.chatInputAttachmentPreviewDiv2}>
				<div className={styles.chatInputAttachmentPreviewDiv3}>
					{attachments.map((attachment) =>
						attachment.kind === 'image' ? (
							<ImagePreview key={attachment.id} attachment={attachment} onRemove={onRemove} />
						) : (
							<DocumentPreview key={attachment.id} attachment={attachment} onRemove={onRemove} />
						),
					)}
				</div>
				{rejection && (
					<p className={styles.chatInputAttachmentPreviewP}>
						<AlertTriangle className={styles.chatInputAttachmentPreviewAlertTriangle} />
						{rejection}
					</p>
				)}
			</div>
		</div>
	);
}

function ImagePreview({ attachment, onRemove }: { attachment: Attachment; onRemove: (id: string) => void }) {
	return (
		<PreviewShell attachment={attachment} onRemove={onRemove}>
			{attachment.error ? (
				<div className={styles.imagePreviewDiv}>
					<AlertTriangle className={styles.imagePreviewAlertTriangle} />
					<span className={styles.imagePreviewSpan}>{attachment.error}</span>
				</div>
			) : attachment.dataUrl ? (
				<img src={attachment.dataUrl} alt='' className={styles.imagePreviewImg} />
			) : (
				<div className={styles.imagePreviewDiv2}>
					<Loader2 className={styles.imagePreviewLoader2} />
				</div>
			)}
		</PreviewShell>
	);
}

function DocumentPreview({ attachment, onRemove }: { attachment: Attachment; onRemove: (id: string) => void }) {
	const isUploading = !attachment.path && !attachment.error;

	return (
		<PreviewShell attachment={attachment} onRemove={onRemove}>
			<div className={cn(styles.documentPreviewDiv, attachment.error && styles.documentPreviewDiv2)}>
				{isUploading ? (
					<Loader2 className={styles.documentPreviewLoader2} />
				) : (
					<AttachmentFileIcon
						fileName={attachment.name}
						className={styles.documentPreviewAttachmentFileIcon}
					/>
				)}
				<div className={styles.documentPreviewDiv3}>
					<p className={styles.documentPreviewP}>{attachment.name}</p>
					<p
						className={cn(
							styles.documentPreviewP2,
							attachment.error ? styles.documentPreviewP3 : styles.documentPreviewP4,
						)}
					>
						{attachment.error ??
							(isUploading
								? 'Uploading...'
								: attachment.size === undefined
									? 'Saved file'
									: formatBytes(attachment.size))}
					</p>
				</div>
			</div>
		</PreviewShell>
	);
}

function PreviewShell({
	attachment,
	onRemove,
	children,
}: {
	attachment: Attachment;
	onRemove: (id: string) => void;
	children: React.ReactNode;
}) {
	return (
		<div className={`${styles.previewShellDiv} group/preview`}>
			{children}
			<button
				type='button'
				aria-label={`Remove ${attachment.name}`}
				onClick={() => onRemove(attachment.id)}
				className={styles.previewShellButton}
			>
				<X className={styles.previewShellX} />
			</button>
		</div>
	);
}
