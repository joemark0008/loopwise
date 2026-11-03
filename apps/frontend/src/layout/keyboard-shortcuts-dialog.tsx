import styles from './keyboard-shortcuts-dialog.module.css';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUTS } from '@/lib/keyboard-shortcuts';

type KeyboardShortcutsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
	const groups = Array.from(new Set(SHORTCUTS.map((entry) => entry.group)));

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={styles.keyboardShortcutsDialogDialogContent}>
				<DialogHeader>
					<DialogTitle>Keyboard shortcuts</DialogTitle>
					<DialogDescription className='sr-only'>
						List of available keyboard shortcuts and their key combinations.
					</DialogDescription>
				</DialogHeader>
				<div className={styles.keyboardShortcutsDialogDiv}>
					{groups.map((group) => (
						<section key={group} className={styles.keyboardShortcutsDialogSection}>
							<h3 className={styles.keyboardShortcutsDialogH3}>{group}</h3>
							<div className={styles.keyboardShortcutsDialogDiv2}>
								{SHORTCUTS.filter((entry) => entry.group === group).map((entry) => (
									<div key={entry.id} className={styles.keyboardShortcutsDialogDiv3}>
										<span>{entry.label}</span>
										<div className={styles.keyboardShortcutsDialogDiv4}>
											<Kbd shortcut={entry.shortcut} />
											{entry.alternateShortcuts?.map((shortcut, index) => (
												<span
													key={`${entry.id}-alternate-${index}`}
													className={styles.keyboardShortcutsDialogDiv4}
												>
													<span className={styles.keyboardShortcutsDialogSpan}>·</span>
													<Kbd shortcut={shortcut} />
												</span>
											))}
										</div>
									</div>
								))}
							</div>
						</section>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
