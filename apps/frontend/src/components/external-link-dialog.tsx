import { useState } from 'react';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import styles from './external-link-dialog.module.css';
import type { LinkSafetyConfig, LinkSafetyModalProps } from 'streamdown';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

/** Streamdown link handling: same-origin links open directly, external ones ask for confirmation first. */
export const markdownLinkSafety: LinkSafetyConfig = {
	enabled: true,
	onLinkCheck: isSameOriginUrl,
	renderModal: (props) => <ExternalLinkDialog {...props} />,
};

export function ExternalLinkDialog({ isOpen, onClose, onConfirm, url }: LinkSafetyModalProps) {
	const { isCopied, copy } = useCopyToClipboard();
	const [isCopyFailed, setIsCopyFailed] = useState(false);

	const handleCopy = () => {
		setIsCopyFailed(false);
		copy(url).catch(() => setIsCopyFailed(true));
	};

	const handleOpen = () => {
		onConfirm();
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className={styles.externalLinkDialogDialogTitle}>
						<ExternalLink className={styles.externalLinkDialogExternalLink} />
						<span>Open external link?</span>
					</DialogTitle>
				</DialogHeader>
				<DialogDescription className={styles.externalLinkDialogDialogDescription}>
					You're about to visit an external website.
				</DialogDescription>
				<div className={styles.externalLinkDialogDiv}>{url}</div>
				<div className={styles.externalLinkDialogDiv2}>
					<Button variant='outline' className={styles.externalLinkDialogButton} onClick={handleCopy}>
						<CopyButtonContent isCopied={isCopied} isCopyFailed={isCopyFailed} />
					</Button>
					<Button className={styles.externalLinkDialogButton2} onClick={handleOpen}>
						<ExternalLink className={styles.externalLinkDialogExternalLink2} />
						Open link
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function CopyButtonContent({ isCopied, isCopyFailed }: { isCopied: boolean; isCopyFailed: boolean }) {
	if (isCopyFailed) {
		return (
			<>
				<X className={styles.externalLinkDialogExternalLink2} />
				Copy failed
			</>
		);
	}
	if (isCopied) {
		return (
			<>
				<Check className={styles.externalLinkDialogExternalLink2} />
				Copied
			</>
		);
	}
	return (
		<>
			<Copy className={styles.externalLinkDialogExternalLink2} />
			Copy link
		</>
	);
}

function isSameOriginUrl(url: string): boolean {
	try {
		return new URL(url, window.location.origin).origin === window.location.origin;
	} catch {
		return false;
	}
}
