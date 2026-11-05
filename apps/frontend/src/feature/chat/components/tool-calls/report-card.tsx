import { useMutation } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Download, FileText } from 'lucide-react';
import { memo, useState } from 'react';
import { createReport } from '@loopwise/shared/tools';
import styles from './report-card.module.css';
import type { ToolCallComponentProps } from '.';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { useAgentContext } from '@/contexts/agent.provider';
import { ReportSections } from '@/feature/reports/report-sections';
import { reportApi } from '@/lib/report-api';

/**
 * Wise's `create_report` (DESIGN.md §7.2): the report's data, frozen when Wise built it, and its AI-drafted narrative.
 * Viewing is a read; Download PDF prints the same data on the server, audited as PHI leaving the system. Nothing is
 * saved to the chart.
 */
export const ReportToolCall = memo(({ toolPart }: ToolCallComponentProps<'create_report'>) => {
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	if (toolPart.state !== 'output-available' || !toolPart.output) {
		return null;
	}
	return <ReportCard toolCallId={toolPart.toolCallId} output={toolPart.output} />;
});

function ReportCard({ toolCallId, output }: { toolCallId: string; output: createReport.Output }) {
	// The report is saved with the reply when the turn ends; the server can only print it from then on.
	const { chatId, isRunning } = useAgentContext();
	const [isOpen, setIsOpen] = useState(false);
	const download = useMutation({
		mutationFn: () => {
			if (!chatId) {
				throw new Error('The chat is not saved yet.');
			}
			return reportApi.downloadPdf({ chatId, toolCallId });
		},
	});
	const { snapshot, narrative } = output;
	const counts = snapshot.sections
		.filter((section) => section.kind === 'table' || section.kind === 'chart')
		.map((section) =>
			section.kind === 'table' ? `${shortTitle(section.title)} ${section.rows.length}` : `${section.title} chart`,
		);

	return (
		<div className={styles.card} data-testid='report-card'>
			<div className={styles.header}>
				<FileText className={styles.icon} />
				<div className={styles.heading}>
					<span className={styles.title}>{snapshot.title}</span>
					<span className={styles.subject}>{snapshot.subject}</span>
					<span className={styles.meta}>
						Data as of {new Date(snapshot.generatedAt).toLocaleString()}
						{snapshot.type === 'encounter_summary' ? '' : ` · last ${snapshot.months} months`}
					</span>
				</div>
				<div className={styles.actions}>
					<Button variant='outline' size='sm' onClick={() => setIsOpen(!isOpen)}>
						{isOpen ? <ChevronUp /> : <ChevronDown />}
						{isOpen ? 'Hide' : 'Preview'}
					</Button>
					<Button
						size='sm'
						onClick={() => download.mutate()}
						disabled={download.isPending || isRunning}
						title={isRunning ? 'Available when Wise finishes replying' : undefined}
						data-testid='report-download'
					>
						<Download />
						{download.isPending ? 'Preparing…' : 'Download PDF'}
					</Button>
				</div>
			</div>
			<div className={styles.chips}>
				<span className={`${styles.chip} ${styles.synthetic}`}>{createReport.WATERMARK}</span>
				{counts.map((count) => (
					<span key={count} className={styles.chip}>
						{count}
					</span>
				))}
			</div>
			{download.isError && (
				<span className={styles.error} role='alert'>
					Could not prepare the PDF: {download.error.message}
				</span>
			)}
			<div className={styles.narrative}>
				<span className={styles.narrativeLabel}>Wise summary — AI draft, verify against the data</span>
				<p className={styles.narrativeText}>{narrative}</p>
			</div>
			{isOpen && <ReportSections sections={snapshot.sections} />}
		</div>
	);
}

/** "Current medicines (issued in the last 180 days)" → "Current medicines"; "Recent laboratory results" → "Lab results". */
const shortTitle = (title: string) =>
	title
		.replace(/ \(.*\)$/, '')
		.replace(/^Recent laboratory results$/, 'Lab results')
		.replace(/ and diagnoses$/, '');
