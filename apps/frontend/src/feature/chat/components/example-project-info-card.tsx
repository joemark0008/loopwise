import { BookOpenText, ChevronDown, ShieldCheck } from 'lucide-react';

import styles from './example-project-info-card.module.css';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function ExampleProjectInfoCard({ compact = false }: { compact?: boolean }) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant='outline' size='icon-sm' className={styles.exampleProjectInfoCardButton}>
					<BookOpenText aria-hidden className={styles.exampleProjectInfoCardBookOpenText} />
					<span className={styles.exampleProjectInfoCardSpan}>
						{compact ? 'About Jaffle Shop' : 'Jaffle Shop'}
					</span>
					{!compact && <ChevronDown aria-hidden className={styles.exampleProjectInfoCardChevronDown} />}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align={compact ? 'end' : 'start'}
				sideOffset={8}
				className={styles.exampleProjectInfoCardPopoverContent}
			>
				<div className={styles.exampleProjectInfoCardDiv}>
					<div
						aria-hidden
						className={styles.exampleProjectInfoCardDiv2}
						style={{
							backgroundImage:
								'conic-gradient(from 45deg, color-mix(in oklch, oklch(0.58 0.13 265) 3%, var(--app-surface)) 0 25%, color-mix(in oklch, oklch(0.58 0.13 265) 12%, var(--app-surface)) 0 50%, color-mix(in oklch, oklch(0.58 0.13 265) 7%, var(--app-surface)) 0 75%, color-mix(in oklch, oklch(0.58 0.13 265) 1%, var(--app-surface)) 0)',
							backgroundSize: '18px 18px',
						}}
					/>
					<h2 className={styles.exampleProjectInfoCardH2}>Jaffle Shop</h2>
				</div>
				<div className={styles.exampleProjectInfoCardDiv3}>
					<p className={styles.exampleProjectInfoCardP}>
						A fictional retail dataset with customers, orders, and payments. Use it to explore Loopwise
						before connecting your own data.
					</p>
					<div className={styles.exampleProjectInfoCardDiv4}>
						<ShieldCheck aria-hidden className={styles.exampleProjectInfoCardShieldCheck} />
						<span>Your own data isn't connected to this chat.</span>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
