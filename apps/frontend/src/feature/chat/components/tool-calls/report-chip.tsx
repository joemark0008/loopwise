import { ArrowUpRight, FileText } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import styles from './report-chip.module.css';
import type { ToolCallComponentProps } from '.';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { useHasSidePanel, useSidePanel } from '@/contexts/side-panel';
import { ReportOverlay, ReportPanel } from '@/feature/reports/report-panel';

/** Reports already opened by themselves: a remount or a replayed chat never opens one again. */
const autoOpened = new Set<string>();

const ACTION_LABELS = { create: 'Created', update: 'Updated', replace: 'Rewritten', restore: 'Restored' } as const;

/**
 * Wise's `report` (DESIGN.md §9.2), as loopwise's story chip: the report opens in the side panel next to the chat (or
 * over the page in an embedded chat), by itself once when Wise writes it live, and again from the chip.
 */
export const ReportChipToolCall = memo(({ toolPart }: ToolCallComponentProps<'report'>) => {
	const sawStream = useRef(toolPart.state !== 'output-available' && toolPart.state !== 'output-error');
	const hasSidePanel = useHasSidePanel();
	const sidePanel = useSidePanel();
	const [overlay, setOverlay] = useState(false);
	const output = toolPart.state === 'output-available' ? toolPart.output : undefined;

	const open = () => {
		if (!output) {
			return;
		}
		if (hasSidePanel) {
			sidePanel.open(<ReportPanel reportId={output.id} onClose={sidePanel.close} />, `report:${output.id}`);
		} else {
			setOverlay(true);
		}
	};

	useEffect(() => {
		if (output && sawStream.current && !autoOpened.has(toolPart.toolCallId)) {
			autoOpened.add(toolPart.toolCallId);
			open();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- opens once, when the output arrives
	}, [output]);

	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	if (!output) {
		return null;
	}
	return (
		<div className={styles.chip} data-testid='report-chip'>
			<FileText className={styles.icon} />
			<div className={styles.text}>
				<span className={styles.title}>Report: {output.title}</span>
				<span className={styles.meta}>
					{ACTION_LABELS[output.action]} · v{output.version}
				</span>
			</div>
			<Button variant='outline' size='sm' onClick={open}>
				Open
				<ArrowUpRight />
			</Button>
			{overlay && <ReportOverlay reportId={output.id} onClose={() => setOverlay(false)} />}
		</div>
	);
});
