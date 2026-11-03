import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import styles from './command-block.module.css';
import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export function CommandBlock({ command }: { command: string }) {
	const { isCopied, copy } = useCopyToClipboard();
	const [copyFailed, setCopyFailed] = useState(false);
	const copyLabel = copyFailed ? 'Copy failed' : isCopied ? 'Copied' : 'Copy command';

	const handleCopy = async () => {
		setCopyFailed(false);
		try {
			await copy(command);
		} catch {
			setCopyFailed(true);
		}
	};

	return (
		<div className={`${styles.commandBlockDiv} group`}>
			<span aria-hidden className={styles.commandBlockSpan}>
				$
			</span>
			<code className={styles.commandBlockCode}>{command}</code>
			{copyFailed && (
				<span role='status' className={styles.commandBlockSpan2}>
					Command was not copied
				</span>
			)}
			<Button
				type='button'
				variant='ghost-muted'
				size='icon-xs'
				aria-label={copyLabel}
				title={copyLabel}
				onClick={() => void handleCopy()}
				className={styles.commandBlockButton}
			>
				{isCopied && !copyFailed ? (
					<Check className={styles.commandBlockCheck} />
				) : (
					<Copy className={copyFailed ? styles.commandBlockCopy : styles.commandBlockCopy2} />
				)}
			</Button>
		</div>
	);
}
