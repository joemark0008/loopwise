import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, FilePlus2, Printer, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createReport } from '@quarry/shared/tools';
import { ReportDocument, useToolOutputs } from './report-document';
import styles from './report-panel.module.css';
import type { report } from '@quarry/shared/tools';
import type { UIMessage } from '@quarry/api/agent/types/chat';
import { Button } from '@/components/ui/button';
import { useAgentContext, useAgentMessages } from '@/contexts/agent.provider';
import { reportApi } from '@/lib/report-api';

interface ReportVersion {
	toolCallId: string;
	output: report.Output;
}

/** Every version of a report in the chat, oldest first: the outputs of its `report` tool calls. */
export function reportVersions(messages: UIMessage[], reportId: string): ReportVersion[] {
	const versions: ReportVersion[] = [];
	for (const message of messages) {
		for (const part of message.parts) {
			if (part.type === 'tool-report' && part.state === 'output-available' && part.output?.id === reportId) {
				versions.push({ toolCallId: part.toolCallId, output: part.output });
			}
		}
	}
	return versions;
}

/**
 * A Wise report in the side panel (DESIGN.md §9.2), as quarry's story viewer: the latest version follows the chat,
 * earlier versions stay one click away, and the header prints, downloads (audited) or saves it.
 */
export function ReportPanel({ reportId, onClose }: { reportId: string; onClose: () => void }) {
	const messages = useAgentMessages();
	const { chatId, isRunning } = useAgentContext();
	const versions = useMemo(() => reportVersions(messages, reportId), [messages, reportId]);
	const outputs = useToolOutputs(messages);
	const latest = versions.at(-1);
	const [selected, setSelected] = useState<number | null>(null);
	// A new version from Wise shows itself, as a story does.
	useEffect(() => setSelected(null), [latest?.output.version]);
	const shown = versions.find((version) => version.output.version === selected) ?? latest;

	const pdf = useMutation({
		mutationFn: (mode: 'download' | 'print') => {
			if (!chatId || !shown) {
				throw new Error('The report is not saved yet.');
			}
			return reportApi.downloadReportVersion({ chatId, toolCallId: shown.toolCallId, mode });
		},
	});

	if (!shown) {
		return null;
	}
	const isLatest = shown === latest;
	return (
		<div className={styles.panel} data-testid='report-panel'>
			<div className={styles.header}>
				<span className={styles.title} title={shown.output.title}>
					{shown.output.title}
				</span>
				<select
					className={styles.versions}
					aria-label='Version'
					value={shown.output.version}
					onChange={(event) => setSelected(Number(event.target.value))}
				>
					{[...versions].reverse().map((version) => (
						<option key={version.toolCallId} value={version.output.version}>
							v{version.output.version}
							{version === latest ? ' · latest' : ''}
						</option>
					))}
				</select>
				<Button
					variant='outline'
					size='sm'
					disabled={pdf.isPending || isRunning}
					onClick={() => pdf.mutate('print')}
				>
					<Printer />
					Print
				</Button>
				<Button
					size='sm'
					disabled={pdf.isPending || isRunning}
					onClick={() => pdf.mutate('download')}
					data-testid='report-panel-download'
				>
					<Download />
					{pdf.isPending ? 'Preparing…' : 'PDF'}
				</Button>
				{shown.output.patientId && chatId && (
					<SaveToChart
						chatId={chatId}
						toolCallId={shown.toolCallId}
						version={shown.output.version}
						disabled={isRunning}
					/>
				)}
				<Button variant='ghost' size='icon-sm' onClick={onClose} aria-label='Close report'>
					<X />
				</Button>
			</div>
			<div className={styles.body}>
				<div className={styles.notice}>
					<span className={styles.synthetic}>{createReport.WATERMARK}</span>
					<span>
						Version {shown.output.version}
						{isLatest ? '' : ` of ${latest?.output.version}`} · narrative drafted by Wise; numbers from the
						results it embeds
					</span>
				</div>
				{pdf.isError && (
					<p className={styles.error} role='alert'>
						Couldn't prepare the PDF: {pdf.error.message}
					</p>
				)}
				<ReportDocument doc={shown.output} outputs={outputs} />
			</div>
		</div>
	);
}

/**
 * Saves the shown version to the patient's chart: the clinician's own action, confirmed in place, once per version.
 * The chart keeps it frozen with the results it embeds (DESIGN.md §9.2).
 */
function SaveToChart({
	chatId,
	toolCallId,
	version,
	disabled,
}: {
	chatId: string;
	toolCallId: string;
	version: number;
	disabled: boolean;
}) {
	const queryClient = useQueryClient();
	const [confirming, setConfirming] = useState(false);
	const saved = useQuery({
		queryKey: reportApi.savedDocument.queryKey(toolCallId),
		queryFn: () => reportApi.savedDocument.fetch(toolCallId),
	});
	const save = useMutation({
		mutationFn: () => reportApi.saveToChart({ chatId, toolCallId }),
		onSuccess: (document) => {
			setConfirming(false);
			void queryClient.invalidateQueries({ queryKey: reportApi.savedDocument.queryKey(toolCallId) });
			void queryClient.invalidateQueries({ queryKey: reportApi.patientDocuments.queryKey(document.patientId) });
		},
	});
	useEffect(() => setConfirming(false), [toolCallId]);

	if (saved.data) {
		return (
			<span className={styles.saved} data-testid='report-saved'>
				<Check />
				Saved to chart
			</span>
		);
	}
	if (confirming) {
		return (
			<span className={styles.confirm} role='group' aria-label='Confirm save to chart'>
				<span>Save v{version} to the patient's chart?</span>
				<Button
					size='sm'
					onClick={() => save.mutate()}
					disabled={save.isPending}
					data-testid='report-save-confirm'
				>
					{save.isPending ? 'Saving…' : 'Save'}
				</Button>
				<Button variant='ghost' size='sm' onClick={() => setConfirming(false)}>
					Cancel
				</Button>
				{save.isError && (
					<span className={styles.error} role='alert'>
						{save.error.message}
					</span>
				)}
			</span>
		);
	}
	return (
		<Button
			variant='outline'
			size='sm'
			disabled={disabled || saved.isPending}
			onClick={() => setConfirming(true)}
			data-testid='report-save'
		>
			<FilePlus2 />
			Save to chart
		</Button>
	);
}

/** The report over the page, where there's no side panel (the patient chart's Wise, the Wise dock). */
export function ReportOverlay({ reportId, onClose }: { reportId: string; onClose: () => void }) {
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);
	return createPortal(
		<div className={styles.overlay} onClick={onClose} role='presentation'>
			<div
				className={styles.overlayPanel}
				role='dialog'
				aria-modal='true'
				aria-label='Report'
				onClick={(event) => event.stopPropagation()}
			>
				<ReportPanel reportId={reportId} onClose={onClose} />
			</div>
		</div>,
		document.body,
	);
}
