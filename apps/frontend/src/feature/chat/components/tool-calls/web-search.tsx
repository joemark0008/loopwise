import { Globe, ExternalLink } from 'lucide-react';
import { ToolCallWrapper } from './tool-call-wrapper';
import styles from './web-search.module.css';
import type { ToolCallComponentProps } from '.';
import { useToolCallContext } from '@/contexts/tool-call';

interface WebSearchSource {
	url: string;
	title?: string | null;
}

type WebSearchAction =
	| { type: 'search'; sources: WebSearchSource[] }
	| { type: 'openPage'; url: string }
	| { type: 'findInPage'; url: string; pattern?: string };

function parseOutput(output: unknown): WebSearchAction {
	if (Array.isArray(output)) {
		const sources = output
			.filter((item) => item?.url)
			.map((item) => ({ url: item.url, title: item.title ?? null }));
		return { type: 'search', sources };
	}

	if (typeof output === 'object' && output !== null) {
		const obj = output as Record<string, unknown>;
		const action = obj.action as Record<string, unknown> | undefined;

		if (action?.type === 'openPage' && typeof action.url === 'string') {
			return { type: 'openPage', url: action.url };
		}
		if (action?.type === 'findInPage' && typeof action.url === 'string') {
			return { type: 'findInPage', url: action.url, pattern: (action.pattern as string) ?? undefined };
		}
		if (action?.type === 'search' && Array.isArray(obj.sources)) {
			const sources = obj.sources
				.filter((s: Record<string, unknown>) => s?.url)
				.map((s: Record<string, unknown>) => ({ url: s.url as string }));
			return { type: 'search', sources };
		}
	}

	return { type: 'search', sources: [] };
}

function getDomain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

function getTitle(action: WebSearchAction, isSettled: boolean): string {
	if (!isSettled) {
		return 'Searching the web';
	}
	switch (action.type) {
		case 'openPage':
			return 'Opened page';
		case 'findInPage':
			return 'Searched in page';
		default:
			return 'Searched the web';
	}
}

function getBadge(action: WebSearchAction): string | undefined {
	if (action.type === 'search' && action.sources.length > 0) {
		return `${action.sources.length} sources`;
	}
	return undefined;
}

const SourceLink = ({ url, title }: { url: string; title?: string | null }) => (
	<a href={url} target='_blank' rel='noopener noreferrer' className={`${styles.sourceLinkA} group/source`}>
		<Globe size={14} className={styles.sourceLinkGlobe} />
		<div className={styles.sourceLinkDiv}>
			{title && <span className={styles.sourceLinkSpan}>{title}</span>}
			<span className={styles.sourceLinkSpan2}>{getDomain(url)}</span>
		</div>
		<ExternalLink size={12} className={styles.sourceLinkExternalLink} />
	</a>
);

export const WebSearchToolCall = ({ toolPart }: ToolCallComponentProps) => {
	const { isSettled } = useToolCallContext();
	const action = parseOutput(toolPart.output);
	const title = getTitle(action, isSettled);
	const badge = getBadge(action);

	return (
		<ToolCallWrapper title={title} badge={badge}>
			{action.type === 'search' && action.sources.length > 0 && (
				<div className={styles.webSearchToolCallDiv}>
					<div className={styles.webSearchToolCallDiv2}>
						{action.sources.map((source, i) => (
							<SourceLink key={i} {...source} />
						))}
					</div>
				</div>
			)}
			{action.type === 'openPage' && (
				<div className={styles.webSearchToolCallDiv2}>
					<SourceLink url={action.url} />
				</div>
			)}
			{action.type === 'findInPage' && (
				<div className={styles.webSearchToolCallDiv2}>
					<SourceLink url={action.url} title={action.pattern ? `Pattern: ${action.pattern}` : undefined} />
				</div>
			)}
		</ToolCallWrapper>
	);
};
