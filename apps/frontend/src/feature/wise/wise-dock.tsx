import { Maximize2, Minimize2, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import styles from './wise-dock.module.css';
import { Button } from '@/components/ui/button';
import { AgentProvider } from '@/contexts/agent.provider';
import { SetChatInputCallbackProvider } from '@/contexts/set-chat-input-callback';
import chartStyles from '@/feature/patients/patient-chart.module.css';
import { WiseConversation } from '@/feature/patients/patient-wise-panel';
import { ChatIdContext } from '@/hooks/use-chat-id';

const SUGGESTIONS = ['Which of my patients are overdue?', 'Find a patient'];

/**
 * Wise beside any page that isn't a patient's (those dock the patient's own chat): a general chat over the page,
 * opened from the top bar. It stays mounted while you move between pages, and never navigates by itself (DESIGN.md
 * §7.2): its links open pages when you choose.
 */
export function WiseDock({ open, onClose }: { open: boolean; onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	const [isExpanded, setIsExpanded] = useState(false);

	useEffect(() => {
		if (!open) {
			return;
		}
		closeRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [open, onClose]);

	return (
		<aside
			className={styles.dock}
			data-expanded={isExpanded || undefined}
			aria-label='Wise'
			id='wise-dock'
			hidden={!open}
		>
			<section className={chartStyles.wisePanel} aria-label='Ask Wise'>
				<header className={chartStyles.wiseHeader}>
					<Sparkles />
					<span>Ask Wise</span>
					<Button
						variant='ghost'
						size='icon-sm'
						className={styles.expand}
						onClick={() => setIsExpanded((expanded) => !expanded)}
						aria-label={isExpanded ? 'Make Wise narrower' : 'Expand Wise'}
						aria-pressed={isExpanded}
					>
						{isExpanded ? <Minimize2 /> : <Maximize2 />}
					</Button>
					<Button ref={closeRef} variant='ghost' size='icon-sm' onClick={onClose} aria-label='Close Wise'>
						<X />
					</Button>
				</header>
				<ChatIdContext.Provider value={undefined}>
					<SetChatInputCallbackProvider>
						<AgentProvider disableNavigation>
							<WiseConversation
								intro='Ask about your patients, results and cases. Wise drafts; you confirm every action.'
								suggestions={SUGGESTIONS}
							/>
						</AgentProvider>
					</SetChatInputCallbackProvider>
				</ChatIdContext.Provider>
			</section>
		</aside>
	);
}
