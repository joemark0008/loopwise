import { X } from 'lucide-react';
import { SelectionCitationExcerpt } from './selection-citation-excerpt';
import styles from './selection-citation-banner.module.css';
import { Button } from '@/components/ui/button';
import { useChatPendingCitation } from '@/hooks/use-chat-pending-citation';
import { chatPendingCitationStore } from '@/stores/chat-pending-citation';
import { useChatId } from '@/hooks/use-chat-id';

export const SelectionCitationBanner = () => {
	const chatId = useChatId();
	const citation = useChatPendingCitation(chatId);

	if (!citation) {
		return null;
	}

	return (
		<div className={styles.selectionCitationBannerDiv}>
			<Button
				variant='ghost'
				size='icon-xs'
				className={styles.selectionCitationBannerButton}
				onClick={() => chatPendingCitationStore.clear(chatId)}
			>
				<X className={styles.selectionCitationBannerX} />
			</Button>
			<SelectionCitationExcerpt
				start={citation.start}
				end={citation.end}
				block={citation.block}
				text={citation.text}
			/>
		</div>
	);
};
