import styles from './mobile-header.module.css';
import { EditableChatTitle } from '@/feature/chat/components/editable-chat-title';
import { ExampleProjectInfoCard } from '@/feature/chat/components/example-project-info-card';
import { useSidebar } from '@/contexts/sidebar';

export function MobileHeader({
	chatId,
	title,
	showExampleProjectInfo = false,
}: {
	chatId?: string;
	title?: string;
	showExampleProjectInfo?: boolean;
}) {
	const { isMobile } = useSidebar();

	if (!isMobile) {
		return null;
	}

	return (
		<div className={`${styles.mobileHeaderDiv} group/header`}>
			{showExampleProjectInfo && <ExampleProjectInfoCard compact />}
			{chatId && title && (
				<>
					<EditableChatTitle chatId={chatId} title={title} className={styles.mobileHeaderEditableChatTitle} />
				</>
			)}
			<div className={styles.mobileHeaderDiv2}></div>
		</div>
	);
}
