import { Check, Copy } from 'lucide-react';

import styles from './clinic-identifier.module.css';
import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export function ClinicIdentifier({ clinicId }: { clinicId: string }) {
	const { isCopied, copy } = useCopyToClipboard();

	return (
		<div className={styles.clinicIdentifierDiv}>
			<code className={styles.clinicIdentifierCode}>{clinicId}</code>
			<Button
				type='button'
				variant='ghost-muted'
				size='icon-xs'
				className={styles.clinicIdentifierButton}
				aria-label={`Copy clinic ID ${clinicId}`}
				onClick={() => void copy(clinicId)}
			>
				{isCopied ? (
					<Check className={styles.clinicIdentifierCheck} />
				) : (
					<Copy className={styles.clinicIdentifierCopy} />
				)}
			</Button>
		</div>
	);
}
