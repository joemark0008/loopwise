import { ExternalLink } from 'lucide-react';
import styles from './open-in-loopwise-button.module.css';
import type { MouseEvent } from 'react';

import { Button } from '@/components/ui/button';

interface OpenInLoopwiseButtonProps {
	url: string;
}

export function OpenInLoopwiseButton({ url }: OpenInLoopwiseButtonProps) {
	return (
		<Button
			variant='outline'
			size='sm'
			className={styles.openInLoopwiseButtonButton}
			asChild
			title='Open in Loopwise'
		>
			<a href={url} target='_blank' rel='noopener noreferrer' onClick={(e) => openLinkViaHost(e, url)}>
				<ExternalLink className={styles.openInLoopwiseButtonExternalLink} />
				<span className={styles.openInLoopwiseButtonSpan}>Open in Loopwise</span>
			</a>
		</Button>
	);
}

function openLinkViaHost(event: MouseEvent<HTMLAnchorElement>, url: string) {
	if (window.parent === window) {
		return;
	}
	event.preventDefault();
	window.parent.postMessage({ type: 'loopwise-open-link', url }, '*');
}
