import { Lock } from 'lucide-react';

import styles from './upgrade-to-enterprise.module.css';
import { cn } from '@/lib/utils';

interface UpgradeToEnterpriseProps {
	className?: string;
	iconOnly?: boolean;
}

/** Badge for upstream enterprise features. loopwise does not port them, so there is no page to link to. */
export function UpgradeToEnterprise({ className, iconOnly = false }: UpgradeToEnterpriseProps) {
	return (
		<span
			aria-label='Upgrade to Enterprise'
			title='Upgrade to Enterprise'
			className={cn(
				styles.upgradeToEnterpriseSpan,
				iconOnly ? styles.upgradeToEnterpriseSpan2 : styles.upgradeToEnterpriseSpan3,
				className,
			)}
		>
			{iconOnly ? (
				<Lock className={styles.upgradeToEnterpriseLock} />
			) : (
				<>
					<Lock className={styles.upgradeToEnterpriseLock2} />
					Enterprise
				</>
			)}
		</span>
	);
}
