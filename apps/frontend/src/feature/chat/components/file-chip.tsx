import { Download, Loader2 } from 'lucide-react';

import { AttachmentFileIcon } from './attachment-file-icon';
import styles from './file-chip.module.css';
import { AttachmentViewer } from '@/components/side-panel/attachment-viewer';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useSidePanel } from '@/contexts/side-panel';
import { useAttachmentDownload } from '@/hooks/use-attachment-download';
import { fileNameOf } from '@/lib/attachments';
import { cn } from '@/lib/utils';

interface FileChipProps {
	/** Virtual path in permanent storage, e.g. `/home/exports/churn-2025.csv`. */
	path: string;
	/** Shown instead of the file name in the path. */
	label?: string;
	className?: string;
}

/**
 * A file in permanent storage: opens in the side panel, or downloads straight away. On a chat
 * someone else shared it is inert, since those files stay in the owner's storage.
 */
export function FileChip({ path, label, className }: FileChipProps) {
	const { open, isReadonlyMode } = useSidePanel();
	const download = useAttachmentDownload(path);
	const fileName = label ?? fileNameOf(path);

	const name = (
		<>
			<AttachmentFileIcon fileName={path} className={styles.nameAttachmentFileIcon} />
			<span className={styles.nameSpan}>{fileName}</span>
		</>
	);

	if (isReadonlyMode) {
		return (
			<SimpleTooltip content={path}>
				<span className={cn(chipClassName, styles.fileChipSpan, className)}>{name}</span>
			</SimpleTooltip>
		);
	}

	return (
		<span className={cn(chipClassName, styles.fileChipSpan2, className)}>
			<SimpleTooltip content={path}>
				<button
					type='button'
					onClick={() => open(<AttachmentViewer path={path} fileName={fileName} />)}
					className={styles.fileChipButton}
				>
					{name}
				</button>
			</SimpleTooltip>
			<SimpleTooltip content={download.error?.message ?? 'Download'}>
				<Button
					variant='ghost-muted'
					size='icon-xs'
					className={styles.fileChipButton2}
					aria-label={`Download ${fileName}`}
					disabled={download.isPending}
					onClick={() => download.mutate()}
				>
					{download.isPending ? <Loader2 className={styles.fileChipLoader2} /> : <Download />}
				</Button>
			</SimpleTooltip>
		</span>
	);
}

const chipClassName = styles.chipClassName;
