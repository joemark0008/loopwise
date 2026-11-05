import { useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { splitReport } from '@loopwise/shared/report-blocks';
import styles from './report-panel.module.css';
import { ReportSections } from './report-sections';
import type { clinicalChart, createReport, report, runAnalyticsSql } from '@loopwise/shared/tools';
import type { UIMessage } from '@loopwise/api/agent/types/chat';
import { markdownLinkSafety } from '@/components/external-link-dialog';
import { ResultChartView, ResultTable } from '@/feature/chat/components/tool-calls/analytics-result';
import { ClinicalChartView } from '@/feature/chat/components/tool-calls/clinical-chart';
import { markdownPlugins } from '@/lib/markdown';

/** The outputs of the chat's tool calls by id: what a report's blocks embed. */
export function useToolOutputs(messages: UIMessage[]): Map<string, { toolName: string; output: unknown }> {
	return useMemo(() => {
		const outputs = new Map<string, { toolName: string; output: unknown }>();
		for (const message of messages) {
			for (const part of message.parts) {
				if (part.type.startsWith('tool-') && 'state' in part && part.state === 'output-available') {
					outputs.set(part.toolCallId, { toolName: part.type.slice('tool-'.length), output: part.output });
				}
			}
		}
		return outputs;
	}, [messages]);
}

/**
 * A Wise report (DESIGN.md §7.2): Wise's markdown, and blocks drawn from the tool results of the chat they embed —
 * the same results the chat shows, so every number on the page traces to a query or metric.
 */
export function ReportDocument({
	doc,
	outputs,
}: {
	doc: report.Output;
	outputs: Map<string, { toolName: string; output: unknown }>;
}) {
	const segments = useMemo(() => splitReport(doc.code), [doc.code]);
	return (
		<article className={styles.document} data-testid='report-document'>
			{segments.map((segment, index) => {
				if (segment.kind === 'markdown') {
					return (
						<div key={index} className={styles.prose}>
							<Streamdown linkSafety={markdownLinkSafety} mode='static' plugins={markdownPlugins}>
								{segment.text}
							</Streamdown>
						</div>
					);
				}
				const result = outputs.get(segment.ref);
				if (!result) {
					return (
						<p key={index} className={styles.missing}>
							This block refers to a result that isn't in the chat.
						</p>
					);
				}
				return <ReportBlock key={index} kind={segment.kind} result={result} />;
			})}
		</article>
	);
}

function ReportBlock({
	kind,
	result,
}: {
	kind: 'chart' | 'table' | 'sections';
	result: { toolName: string; output: unknown };
}) {
	if (kind === 'sections') {
		return <ReportSections sections={(result.output as createReport.Output).snapshot.sections} />;
	}
	const output = result.output as { chart?: unknown };
	if (kind === 'chart' && output.chart && typeof output.chart === 'object' && 'chartType' in output.chart) {
		const chart = output.chart as clinicalChart.ChartSpec;
		return (
			<figure className={styles.block}>
				<figcaption className={styles.blockTitle}>{chart.title}</figcaption>
				<ClinicalChartView chart={chart} />
			</figure>
		);
	}
	const analytics = result.output as runAnalyticsSql.Output & { label?: string };
	const title = analytics.label ?? analytics.purpose;
	return (
		<figure className={styles.block}>
			<figcaption className={styles.blockTitle}>{analytics.chart?.title ?? title}</figcaption>
			{kind === 'chart' && analytics.chart ? (
				<ResultChartView chart={analytics.chart} columns={analytics.columns} rows={analytics.rows} />
			) : (
				<ResultTable columns={analytics.columns} rows={analytics.rows} />
			)}
		</figure>
	);
}
