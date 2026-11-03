import { useQuery } from '@tanstack/react-query';
import { FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ReportDocument } from './report-document';
import styles from './report-panel.module.css';
import type { report } from '@quarry/shared/tools';
import { PageSection } from '@/components/clinical/page-header';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { formatDateTime } from '@/feature/encounters/encounter-format';
import { reportApi } from '@/lib/report-api';

/** The chart's saved documents (DESIGN.md §9.2): Wise reports the clinician saved, each opening as it was saved. */
export function SavedDocuments({ patientId }: { patientId: string }) {
	const documents = useQuery({
		queryKey: reportApi.patientDocuments.queryKey(patientId),
		queryFn: () => reportApi.patientDocuments.fetch(patientId),
	});
	const [openId, setOpenId] = useState<string | null>(null);
	return (
		<PageSection title='Documents'>
			{documents.error ? (
				<ErrorMessage message={documents.error.message} />
			) : !documents.data || documents.data.length === 0 ? (
				<p className={styles.missing}>No saved reports yet. Ask Wise for one and save it from its panel.</p>
			) : (
				<ul className={styles.documents} data-testid='saved-documents'>
					{documents.data.map((document) => (
						<li key={document.id}>
							<button type='button' className={styles.documentRow} onClick={() => setOpenId(document.id)}>
								<FileText />
								<span className={styles.documentTitle}>{document.title}</span>
								<span className={styles.documentMeta}>
									v{document.version} · {document.createdByName} ·{' '}
									{formatDateTime(document.createdAt)}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
			{openId && <DocumentOverlay id={openId} onClose={() => setOpenId(null)} />}
		</PageSection>
	);
}

/** A saved document over the chart, drawn from the results frozen with it. */
function DocumentOverlay({ id, onClose }: { id: string; onClose: () => void }) {
	const document = useQuery({
		queryKey: reportApi.document.queryKey(id),
		queryFn: () => reportApi.document.fetch(id),
	});
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);
	const doc = document.data;
	return createPortal(
		<div className={styles.overlay} onClick={onClose} role='presentation'>
			<div
				className={styles.overlayPanel}
				role='dialog'
				aria-modal='true'
				aria-label='Saved document'
				onClick={(event) => event.stopPropagation()}
			>
				<div className={styles.panel} data-testid='saved-document'>
					<div className={styles.header}>
						<span className={styles.title}>{doc?.title ?? 'Document'}</span>
						<Button variant='ghost' size='icon-sm' onClick={onClose} aria-label='Close document'>
							<X />
						</Button>
					</div>
					<div className={styles.body}>
						{document.error && <ErrorMessage message={document.error.message} />}
						{doc && (
							<>
								<div className={styles.notice}>
									<span>
										Version {doc.version} saved by {doc.createdByName} on{' '}
										{formatDateTime(doc.createdAt)} · narrative drafted by Wise
									</span>
								</div>
								<ReportDocument
									doc={{ code: doc.body } as report.Output}
									outputs={
										new Map(
											Object.entries(
												doc.data as Record<string, { toolName: string; output: unknown }>,
											),
										)
									}
								/>
							</>
						)}
					</div>
				</div>
			</div>
		</div>,
		window.document.body,
	);
}
