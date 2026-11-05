import { useId, useMemo, useState } from 'react';
import { Streamdown } from 'streamdown';
import { KpiCard } from '@loopwise/shared/chart-builder';
import { parseReport } from '@loopwise/shared/report-blocks';
import { kpiDisplay } from '@loopwise/shared/report-kpi';
import styles from './report-panel.module.css';
import { ReportSections } from './report-sections';
import type { CSSProperties } from 'react';
import type { ReportBlock, ReportSegment, ReportTab } from '@loopwise/shared/report-blocks';
import type { clinicalChart, createReport, report, runAnalyticsSql } from '@loopwise/shared/tools';
import type { UIMessage } from '@loopwise/api/agent/types/chat';
import { markdownLinkSafety } from '@/components/external-link-dialog';
import { TabBar, TabPanel } from '@/components/ui/tab-bar';
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

type Outputs = Map<string, { toolName: string; output: unknown }>;

/**
 * A Wise report (DESIGN.md §7.2): Wise's markdown, and blocks drawn from the tool results of the chat they embed —
 * the same results the chat shows, so every number on the page traces to a query or metric. Grids place blocks side
 * by side (stacked when the panel is narrow), and a report with tabs shows one tab at a time.
 */
export function ReportDocument({ doc, outputs }: { doc: report.Output; outputs: Outputs }) {
	const tabs = useMemo((): ReportTab[] | null => {
		try {
			return parseReport(doc.code);
		} catch {
			return null;
		}
	}, [doc.code]);
	if (!tabs) {
		return <p className={styles.missing}>This report's layout can't be shown.</p>;
	}
	return tabs.length === 1 && tabs[0].title === null ? (
		<article className={styles.document} data-testid='report-document'>
			<Segments segments={tabs[0].segments} outputs={outputs} />
		</article>
	) : (
		<TabbedReport tabs={tabs} outputs={outputs} />
	);
}

function TabbedReport({ tabs, outputs }: { tabs: ReportTab[]; outputs: Outputs }) {
	const idBase = useId();
	const [active, setActive] = useState('0');
	// A new version may have fewer tabs than the one shown before.
	const shown = Number(active) < tabs.length ? active : '0';
	return (
		<article className={styles.document} data-testid='report-document'>
			<TabBar
				idBase={idBase}
				tabs={tabs.map((tab, index) => ({ id: String(index), label: tab.title }))}
				activeTab={shown}
				onTabChange={setActive}
			/>
			<TabPanel idBase={idBase} tabId={shown} className={styles.document}>
				<Segments segments={tabs[Number(shown)].segments} outputs={outputs} />
			</TabPanel>
		</article>
	);
}

function Segments({ segments, outputs }: { segments: ReportSegment[]; outputs: Outputs }) {
	return segments.map((segment, index) => {
		if (segment.kind === 'markdown') {
			return (
				<div key={index} className={styles.prose}>
					<Streamdown linkSafety={markdownLinkSafety} mode='static' plugins={markdownPlugins}>
						{segment.text}
					</Streamdown>
				</div>
			);
		}
		if (segment.kind === 'grid') {
			const widths = segment.widths ?? segment.blocks.map(() => 1);
			return (
				<div
					key={index}
					className={styles.grid}
					style={
						{
							'--report-grid-columns': widths.map((width) => `minmax(0, ${width}fr)`).join(' '),
						} as CSSProperties
					}
				>
					{segment.blocks.map((block, at) => (
						<EmbeddedBlock key={at} block={block} outputs={outputs} />
					))}
				</div>
			);
		}
		return <EmbeddedBlock key={index} block={segment} outputs={outputs} />;
	});
}

function EmbeddedBlock({ block, outputs }: { block: ReportBlock; outputs: Outputs }) {
	const result = outputs.get(block.ref);
	if (!result) {
		return <p className={styles.missing}>This block refers to a result that isn't in the chat.</p>;
	}
	if (block.kind === 'kpi') {
		const shown = kpiDisplay(block, result.output as runAnalyticsSql.Output);
		if ('problem' in shown) {
			return <p className={styles.missing}>{shown.problem}</p>;
		}
		return (
			<figure className={styles.block}>
				<figcaption className={styles.blockTitle}>{shown.label}</figcaption>
				<KpiCard value={shown.value} comparison={shown.comparison} />
			</figure>
		);
	}
	return <ReportBlockView kind={block.kind} result={result} />;
}

function ReportBlockView({
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
