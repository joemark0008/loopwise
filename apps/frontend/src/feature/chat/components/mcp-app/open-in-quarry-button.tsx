import { ExternalLink } from 'lucide-react';
import styles from './open-in-quarry-button.module.css';
import type { MouseEvent } from 'react';

import { Button } from '@/components/ui/button';

interface OpenInQuarryButtonProps {
	url: string;
}

export function OpenInQuarryButton({ url }: OpenInQuarryButtonProps) {
	return (
		<Button
			variant='outline'
			size='sm'
			className={styles.openInQuarryButtonButton}
			asChild
			title='Open in Loopwise'
		>
			<a href={url} target='_blank' rel='noopener noreferrer' onClick={(e) => openLinkViaHost(e, url)}>
				<ExternalLink className={styles.openInQuarryButtonExternalLink} />
				<span className={styles.openInQuarryButtonSpan}>Open in Loopwise</span>
			</a>
		</Button>
	);
}

function openLinkViaHost(event: MouseEvent<HTMLAnchorElement>, url: string) {
	if (window.parent === window) {
		return;
	}
	event.preventDefault();
	window.parent.postMessage({ type: 'quarry-open-link', url }, '*');
}
