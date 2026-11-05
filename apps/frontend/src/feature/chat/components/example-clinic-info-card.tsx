import { BookOpenText, ChevronDown, ShieldCheck } from 'lucide-react';

import styles from './example-clinic-info-card.module.css';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function ExampleClinicInfoCard({ compact = false }: { compact?: boolean }) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant='outline' size='icon-sm' className={styles.exampleClinicInfoCardButton}>
					<BookOpenText aria-hidden className={styles.exampleClinicInfoCardBookOpenText} />
					<span className={styles.exampleClinicInfoCardSpan}>
						{compact ? 'About Jaffle Shop' : 'Jaffle Shop'}
					</span>
					{!compact && <ChevronDown aria-hidden className={styles.exampleClinicInfoCardChevronDown} />}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align={compact ? 'end' : 'start'}
				sideOffset={8}
				className={styles.exampleClinicInfoCardPopoverContent}
			>
				<div className={styles.exampleClinicInfoCardDiv}>
					<div
						aria-hidden
						className={styles.exampleClinicInfoCardDiv2}
						style={{
							backgroundImage:
								'conic-gradient(from 45deg, color-mix(in oklch, oklch(0.58 0.13 265) 3%, var(--app-surface)) 0 25%, color-mix(in oklch, oklch(0.58 0.13 265) 12%, var(--app-surface)) 0 50%, color-mix(in oklch, oklch(0.58 0.13 265) 7%, var(--app-surface)) 0 75%, color-mix(in oklch, oklch(0.58 0.13 265) 1%, var(--app-surface)) 0)',
							backgroundSize: '18px 18px',
						}}
					/>
					<h2 className={styles.exampleClinicInfoCardH2}>Jaffle Shop</h2>
				</div>
				<div className={styles.exampleClinicInfoCardDiv3}>
					<p className={styles.exampleClinicInfoCardP}>
						A fictional retail dataset with customers, orders, and payments. Use it to explore Loopwise
						before connecting your own data.
					</p>
					<div className={styles.exampleClinicInfoCardDiv4}>
						<ShieldCheck aria-hidden className={styles.exampleClinicInfoCardShieldCheck} />
						<span>Your own data isn't connected to this chat.</span>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
