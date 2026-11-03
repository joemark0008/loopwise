import { Globe, ExternalLink } from 'lucide-react';
import { ToolCallWrapper } from './tool-call-wrapper';
import styles from './web-fetch.module.css';
import type { ToolCallComponentProps } from '.';
import { useToolCallContext } from '@/contexts/tool-call';

interface WebFetchResult {
	url: string;
	title?: string | null;
}

function parseOutput(output: unknown): WebFetchResult | null {
	if (typeof output !== 'object' || output === null) {
		return null;
	}
	const obj = output as Record<string, unknown>;
	if (typeof obj.url !== 'string') {
		return null;
	}
	const content = obj.content as Record<string, unknown> | undefined;
	return {
		url: obj.url,
		title: (content?.title as string) ?? null,
	};
}

function getDomain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

export const WebFetchToolCall = ({ toolPart }: ToolCallComponentProps) => {
	const { isSettled } = useToolCallContext();
	const result = parseOutput(toolPart.output);
	const title = isSettled ? 'Fetched page' : 'Fetching page';

	return (
		<ToolCallWrapper title={title}>
			{result && (
				<div className={styles.webFetchToolCallDiv}>
					<a
						href={result.url}
						target='_blank'
						rel='noopener noreferrer'
						className={`${styles.webFetchToolCallA} group/source`}
					>
						<Globe size={14} className={styles.webFetchToolCallGlobe} />
						<div className={styles.webFetchToolCallDiv2}>
							{result.title && <span className={styles.webFetchToolCallSpan}>{result.title}</span>}
							<span className={styles.webFetchToolCallSpan2}>{getDomain(result.url)}</span>
						</div>
						<ExternalLink size={12} className={styles.webFetchToolCallExternalLink} />
					</a>
				</div>
			)}
		</ToolCallWrapper>
	);
};
