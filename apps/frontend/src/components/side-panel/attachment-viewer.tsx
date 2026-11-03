import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { SidePanelHeader } from './side-panel-header';
import styles from './attachment-viewer.module.css';
import type { AttachmentPreview, AttachmentSheet } from '@/lib/attachment-preview';
import { AttachmentFileIcon } from '@/feature/chat/components/attachment-file-icon';
import { MarkdownTable } from '@/feature/chat/components/chat-messages/markdown-table';
import { TextFilePreview } from '@/feature/chat/components/text-file-preview';
import { TableDisplay } from '@/feature/chat/components/tool-calls/display-table';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TabBar } from '@/components/ui/tab-bar';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useAttachmentDownload } from '@/hooks/use-attachment-download';
import { loadAttachmentPreview, MAX_PREVIEW_ROWS, MAX_TABULAR_PREVIEW_SIZE_MB } from '@/lib/attachment-preview';
import { markdownPlugins } from '@/lib/markdown';
import { markdownLinkSafety } from '@/components/external-link-dialog';

const markdownComponents = { table: ({ node, className }: any) => <MarkdownTable node={node} className={className} /> };

interface AttachmentViewerProps {
	/** Virtual path of the file in permanent storage. */
	path: string;
	fileName: string;
}

/** A file in permanent storage, shown as its own side panel. */
export function AttachmentViewer({ path, fileName }: AttachmentViewerProps) {
	const preview = useQuery({
		queryKey: ['attachment-preview', path],
		queryFn: () => loadAttachmentPreview(path),
		staleTime: Infinity,
		retry: false,
	});
	const download = useAttachmentDownload(path);

	return (
		<div className={styles.attachmentViewerDiv}>
			<SidePanelHeader
				title={fileName}
				label={path}
				actions={
					<SimpleTooltip content='Download'>
						<Button
							variant='ghost-muted'
							size='icon-sm'
							className={styles.attachmentViewerButton}
							aria-label='Download'
							disabled={download.isPending}
							onClick={() => download.mutate()}
						>
							{download.isPending ? <Loader2 className={styles.attachmentViewerLoader2} /> : <Download />}
						</Button>
					</SimpleTooltip>
				}
			/>

			{download.error && <ErrorBanner message={download.error.message} />}

			{preview.isPending ? (
				<div className={styles.attachmentViewerDiv2}>
					<Spinner />
				</div>
			) : preview.error ? (
				<Notice fileName={fileName} message={preview.error.message} />
			) : (
				<PreviewBody preview={preview.data} fileName={fileName} />
			)}
		</div>
	);
}

function PreviewBody({ preview, fileName }: { preview: AttachmentPreview; fileName: string }) {
	switch (preview.kind) {
		case 'table':
			return <SheetsPreview sheets={preview.sheets} />;
		case 'markdown':
			return <MarkdownPreview content={preview.content} />;
		case 'text':
			return (
				<div className={styles.previewBodyDiv}>
					<TextFilePreview filePath={fileName} content={preview.content} />
				</div>
			);
		case 'pdf':
			return <PdfPreview blob={preview.blob} fileName={fileName} />;
		case 'too-large':
			return (
				<Notice
					fileName={fileName}
					message={`Files over ${MAX_TABULAR_PREVIEW_SIZE_MB} MB are not parsed in the browser. Download it to open it.`}
				/>
			);
		case 'unsupported':
			return (
				<Notice
					fileName={fileName}
					message='Loopwise cannot preview this kind of file. Download it to open it.'
				/>
			);
	}
}

function SheetsPreview({ sheets }: { sheets: AttachmentSheet[] }) {
	const [activeName, setActiveName] = useState(sheets[0]?.name ?? '');
	const sheet = sheets.find((candidate) => candidate.name === activeName) ?? sheets[0];

	if (!sheet) {
		return <Notice message='This file holds no sheet to show.' />;
	}

	return (
		<div className={styles.sheetsPreviewDiv}>
			{sheets.length > 1 && (
				<TabBar
					tabs={sheets.map(({ name }) => ({ id: name, label: name }))}
					activeTab={sheet.name}
					onTabChange={setActiveName}
					idBase='attachment-sheet'
					className={styles.sheetsPreviewTabBar}
				/>
			)}
			{sheet.truncated && (
				<div className={styles.sheetsPreviewDiv2}>
					Showing the first {MAX_PREVIEW_ROWS.toLocaleString()} rows. Download the file to see the rest.
				</div>
			)}
			<TableDisplay
				data={sheet.rows}
				columns={sheet.columns}
				className={styles.previewBodyDiv}
				tableContainerClassName={styles.sheetsPreviewTableDisplay}
				emptyLabel='This sheet is empty'
				compactFooter
			/>
		</div>
	);
}

function MarkdownPreview({ content }: { content: string }) {
	return (
		<div className={styles.markdownPreviewDiv}>
			<Streamdown
				linkSafety={markdownLinkSafety}
				mode='static'
				plugins={markdownPlugins}
				components={markdownComponents}
			>
				{content}
			</Streamdown>
		</div>
	);
}

function PdfPreview({ blob, fileName }: { blob: Blob; fileName: string }) {
	const [url, setUrl] = useState<string | null>(null);

	useEffect(() => {
		const objectUrl = URL.createObjectURL(blob);
		setUrl(objectUrl);
		return () => URL.revokeObjectURL(objectUrl);
	}, [blob]);

	if (!url) {
		return null;
	}

	return <iframe src={url} title={fileName} className={styles.pdfPreviewIframe} />;
}

function Notice({ message, fileName }: { message: string; fileName?: string }) {
	return (
		<div className={styles.noticeDiv}>
			{fileName && <AttachmentFileIcon fileName={fileName} className={styles.noticeAttachmentFileIcon} />}
			<p className={styles.noticeP}>{message}</p>
		</div>
	);
}

function ErrorBanner({ message }: { message: string }) {
	return <div className={styles.errorBannerDiv}>{message}</div>;
}
