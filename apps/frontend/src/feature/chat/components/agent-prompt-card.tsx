import { ScrollText, Check, Copy } from 'lucide-react';
import { useState } from 'react';

import styles from './agent-prompt-card.module.css';
import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export function AgentPromptCard({ prompt }: { prompt: string }) {
	const { isCopied, copy } = useCopyToClipboard();
	const [copyFailed, setCopyFailed] = useState(false);
	const copyLabel = copyFailed ? 'Copy failed' : isCopied ? 'Copied' : 'Copy prompt';

	const handleCopy = async () => {
		setCopyFailed(false);
		try {
			await copy(prompt);
		} catch {
			setCopyFailed(true);
		}
	};

	return (
		<div className={styles.agentPromptCardDiv}>
			<div className={styles.agentPromptCardDiv2}>
				<ScrollText className={styles.agentPromptCardScrollText} />
				<div className={styles.agentPromptCardDiv3}>
					<span className={styles.agentPromptCardSpan}>Local agent prompt</span>
					<p className={styles.agentPromptCardP}>
						Open your coding agent in the project folder, then paste this prompt.
					</p>
				</div>
				<Button
					type='button'
					variant='ghost-muted'
					size='icon-xs'
					aria-label={copyLabel}
					title={copyLabel}
					onClick={() => void handleCopy()}
				>
					{isCopied && !copyFailed ? <Check className={styles.agentPromptCardCheck} /> : <Copy />}
				</Button>
			</div>
			<div className={styles.agentPromptCardDiv4}>
				<PromptText prompt={prompt} />
			</div>
			{copyFailed && (
				<p role='status' className={styles.agentPromptCardP2}>
					Prompt was not copied
				</p>
			)}
		</div>
	);
}

function PromptText({ prompt }: { prompt: string }) {
	return (
		<div className={styles.promptTextDiv}>
			{prompt.split('\n').map((line, index) => {
				const text = line.trim();

				if (!text) {
					return <div key={index} aria-hidden className={styles.promptTextDiv2} />;
				}

				if (/^[A-Z][A-Z\s]+$/.test(text)) {
					return (
						<p key={index} className={styles.promptTextP}>
							{text}
						</p>
					);
				}

				if (/^(?:npx|uv|pip|unset|loopwise)\b/.test(text)) {
					return (
						<code key={index} className={styles.promptTextCode}>
							{text}
						</code>
					);
				}

				return (
					<p key={index} className={styles.promptTextP2}>
						{text}
					</p>
				);
			})}
		</div>
	);
}
