import styles from './report-sections.module.css';
import type { createReport } from '@loopwise/shared/tools';
import { ClinicalChartView } from '@/feature/chat/components/tool-calls/clinical-chart';

/** The data sections of a Wise report (DESIGN.md §9.2), as the server froze them; the PDF prints the same ones. */
export function ReportSections({ sections }: { sections: createReport.Section[] }) {
	return (
		<div className={styles.sections}>
			{sections.map((section, index) => (
				<section key={`${section.title}-${index}`}>
					<h4 className={styles.sectionTitle}>{section.title}</h4>
					<SectionBody section={section} />
				</section>
			))}
		</div>
	);
}

function SectionBody({ section }: { section: createReport.Section }) {
	switch (section.kind) {
		case 'facts':
			return (
				<dl className={styles.facts}>
					{section.facts.map((fact) => (
						<div key={fact.label} className={styles.fact}>
							<dt>{fact.label}</dt>
							<dd>{fact.value}</dd>
						</div>
					))}
				</dl>
			);
		case 'table':
			return section.rows.length === 0 ? (
				<p className={styles.empty}>{section.empty}</p>
			) : (
				<div className={styles.tableWrap}>
					<table className={styles.table}>
						<thead>
							<tr>
								{section.columns.map((column) => (
									<th key={column}>{column}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{section.rows.map((row, rowIndex) => (
								<tr key={rowIndex}>
									{row.map((cell, cellIndex) => (
										<td key={cellIndex}>{cell}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			);
		case 'chart':
			return <ClinicalChartView chart={section.chart} />;
		case 'text':
			return <p className={styles.text}>{section.text}</p>;
	}
}
