import { X } from 'lucide-react';

import styles from './side-panel-header.module.css';
import { useSidePanel } from '@/contexts/side-panel';
import { Button } from '@/components/ui/button';

interface SidePanelHeaderProps {
	title: string;
	label?: string;
	actions?: React.ReactNode;
}

export function SidePanelHeader({ title, label, actions }: SidePanelHeaderProps) {
	const { close } = useSidePanel();

	return (
		<div className={styles.sidePanelHeaderDiv}>
			<Button
				variant='ghost'
				size='icon-sm'
				className={styles.sidePanelHeaderButton}
				onClick={close}
				aria-label='Close'
			>
				<X className={styles.sidePanelHeaderX} strokeWidth={2.25} />
			</Button>
			<div className={styles.sidePanelHeaderDiv2}>
				{label && <div className={styles.sidePanelHeaderDiv3}>{label}</div>}
				<div className={styles.sidePanelHeaderDiv4} title={title}>
					{title}
				</div>
			</div>
			{actions}
		</div>
	);
}
