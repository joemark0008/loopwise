import styles from './mobile-header.module.css';
import { EditableChatTitle } from '@/feature/chat/components/editable-chat-title';
import { ExampleClinicInfoCard } from '@/feature/chat/components/example-clinic-info-card';
import { useSidebar } from '@/contexts/sidebar';

export function MobileHeader({
	chatId,
	title,
	showExampleClinicInfo = false,
}: {
	chatId?: string;
	title?: string;
	showExampleClinicInfo?: boolean;
}) {
	const { isMobile } = useSidebar();

	if (!isMobile) {
		return null;
	}

	return (
		<div className={`${styles.mobileHeaderDiv} group/header`}>
			{showExampleClinicInfo && <ExampleClinicInfoCard compact />}
			{chatId && title && (
				<>
					<EditableChatTitle chatId={chatId} title={title} className={styles.mobileHeaderEditableChatTitle} />
				</>
			)}
			<div className={styles.mobileHeaderDiv2}></div>
		</div>
	);
}
