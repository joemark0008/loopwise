import { RotateCw } from 'lucide-react';
import styles from './tool-output-fallback.module.css';
import { Button } from '@/components/ui/button';
import { useToolCallContext } from '@/contexts/tool-call';

interface Props {
	/** What to show while the call is genuinely in flight, e.g. "Executing query...". */
	runningLabel: string;
}

/**
 * Body for a tool call that has no output to render.
 *
 * A tool part without output means one of two things, and they must not look alike: the call is
 * still running, or the message stopped streaming and the output never arrived. The second
 * happens when the stream to this tab drops mid-run; the server usually finished and persisted
 * the result, so a reload shows it.
 *
 * Rendering the in-flight placeholder for both is what makes a dropped stream read as a hung
 * page: the tab has already set `isRunning=false`, so nothing is going to update it.
 *
 * `read.tsx`, `grep.tsx` and `read-query-result.tsx` already gate their placeholder on
 * `isSettled`; this centralizes the same rule for the tool bodies that did not.
 */
export const ToolOutputFallback = ({ runningLabel }: Props) => {
	const { isSettled } = useToolCallContext();

	if (!isSettled) {
		return <div className={styles.toolOutputFallbackDiv}>{runningLabel}</div>;
	}

	return (
		<div className={styles.toolOutputFallbackDiv2}>
			<p className={styles.toolOutputFallbackP}>No result reached this tab.</p>
			<p className={styles.toolOutputFallbackP2}>
				The connection dropped before the result arrived. It may have completed on the server — reload to load
				the stored result.
			</p>
			<Button
				variant='outline'
				size='sm'
				className={styles.toolOutputFallbackButton}
				onClick={() => {
					window.location.reload();
				}}
			>
				<RotateCw className={styles.toolOutputFallbackRotateCw} />
				Reload page
			</Button>
		</div>
	);
};
