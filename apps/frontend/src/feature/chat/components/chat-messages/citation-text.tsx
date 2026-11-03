import { memo } from 'react';
import { Streamdown } from 'streamdown';
import { normalizeCitationMarkers, stripAssistantTags } from '@loopwise/shared';

import { MarkdownTable } from './markdown-table';
import { StreamingMarkdown } from './streaming-markdown';
import styles from './citation-text.module.css';
import { CitationPopover } from '@/feature/chat/components/citation-popover';
import { FileChip } from '@/feature/chat/components/file-chip';
import { isStoredFilePath } from '@/lib/attachments';
import { markdownPlugins } from '@/lib/markdown';
import { markdownLinkSafety } from '@/components/external-link-dialog';

const CLOBBER_PREFIX = 'user-content-';
const SETTLED_COMPONENTS = {
	table: MarkdownTableRenderer,
	'citation-number': CitationNumberRenderer,
	'saved-file': SavedFileRenderer,
};
const STREAMING_COMPONENTS = {
	table: MarkdownTableRenderer,
};
const ALLOWED_TAGS = {
	'citation-number': ['id', 'column'],
	'saved-file': ['path'],
};
const LITERAL_TAG_CONTENT = ['citation-number', 'saved-file'];
const INLINE_CODE_PATTERN = /(?<![\\`])`([^`\r\n]+)`(?!`)/g;
const SAVED_FILE_ELEMENT_PATTERN =
	/^<saved-file\s+path\s*=\s*(?:"[^"\r\n]+"|'[^'\r\n]+')\s*>[^`\r\n]*?<\/saved-file\s*>$/;
const SAVED_FILE_TAG_START = '<saved-file';

export const AssistantTextWithCitation = memo(({ text, isStreaming }: { text: string; isStreaming: boolean }) => {
	if (isStreaming) {
		return (
			<StreamingMarkdown
				allowedTags={ALLOWED_TAGS}
				components={STREAMING_COMPONENTS}
				literalTagContent={LITERAL_TAG_CONTENT}
				text={text}
				transform={prepareStreamingMarkdown}
			/>
		);
	}

	return <SettledMarkdown markdown={unwrapBacktickedSavedFiles(normalizeCitationMarkers(text))} />;
});

function SettledMarkdown({ markdown }: { markdown: string }) {
	return (
		<Streamdown
			linkSafety={markdownLinkSafety}
			className='assistant-markdown'
			plugins={markdownPlugins}
			allowedTags={ALLOWED_TAGS}
			literalTagContent={LITERAL_TAG_CONTENT}
			components={SETTLED_COMPONENTS}
		>
			{markdown}
		</Streamdown>
	);
}

function unwrapBacktickedSavedFiles(markdown: string): string {
	return transformMarkdownOutsideCodeBlocks(markdown, (line) =>
		line.replace(INLINE_CODE_PATTERN, (match, value: string) => (isSavedFileElement(value) ? value : match)),
	);
}

function prepareStreamingMarkdown(markdown: string): string {
	return transformMarkdownOutsideCodeBlocks(markdown, suppressBacktickedSavedFiles);
}

function suppressBacktickedSavedFiles(line: string): string {
	let result = '';
	let offset = 0;

	while (offset < line.length) {
		const backtickOffset = line.indexOf('`', offset);
		if (backtickOffset === -1) {
			return result + stripAssistantTags(line.slice(offset));
		}

		if (!isSingleUnescapedBacktick(line, backtickOffset)) {
			result += stripAssistantTags(line.slice(offset, backtickOffset + 1));
			offset = backtickOffset + 1;
			continue;
		}

		result += stripAssistantTags(line.slice(offset, backtickOffset));
		const closingBacktickOffset = findClosingBacktick(line, backtickOffset + 1);
		if (closingBacktickOffset === -1) {
			return couldStartSavedFileTag(line.slice(backtickOffset + 1))
				? result
				: result + stripAssistantTags(line.slice(backtickOffset));
		}
		const value = line.slice(backtickOffset + 1, closingBacktickOffset);
		if (!isSavedFileElement(value)) {
			result += line.slice(backtickOffset, closingBacktickOffset + 1);
		}
		offset = closingBacktickOffset + 1;
	}

	return result;
}

function isSavedFileElement(value: string): boolean {
	return SAVED_FILE_ELEMENT_PATTERN.test(value);
}

function couldStartSavedFileTag(value: string): boolean {
	if (!value.startsWith('<')) {
		return false;
	}

	if (SAVED_FILE_TAG_START.startsWith(value)) {
		return true;
	}

	if (!value.startsWith(SAVED_FILE_TAG_START)) {
		return false;
	}

	const nextCharacter = value[SAVED_FILE_TAG_START.length];
	return nextCharacter === undefined || nextCharacter === '>' || /\s/.test(nextCharacter);
}

function findClosingBacktick(line: string, offset: number): number {
	for (let index = offset; index < line.length; index += 1) {
		if (line[index] === '`' && isSingleUnescapedBacktick(line, index)) {
			return index;
		}
	}

	return -1;
}

function isSingleUnescapedBacktick(line: string, offset: number): boolean {
	return line[offset - 1] !== '\\' && line[offset - 1] !== '`' && line[offset + 1] !== '`';
}

function transformMarkdownOutsideCodeBlocks(markdown: string, transformLine: (line: string) => string): string {
	return splitMarkdownLines(markdown)
		.map(({ text, isCode }) => (isCode ? text : transformLine(text)))
		.join('\n');
}

function splitMarkdownLines(markdown: string): { text: string; isCode: boolean }[] {
	let fence: { marker: string; length: number } | undefined;

	return markdown.split('\n').map((text) => {
		const fenceMarker = getFenceMarker(text);
		if (fence) {
			if (fenceMarker?.marker === fence.marker && fenceMarker.length >= fence.length && fenceMarker.isClosing) {
				fence = undefined;
			}
			return { text, isCode: true };
		}

		if (fenceMarker) {
			fence = fenceMarker;
			return { text, isCode: true };
		}

		return { text, isCode: /^(?: {4}|\t)/.test(text) };
	});
}

function getFenceMarker(line: string): { marker: string; length: number; isClosing: boolean } | undefined {
	const match = /^(?:(?: {0,3}>[ \t]?)|(?: {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+))* {0,3}(`{3,}|~{3,})(.*)\r?$/.exec(line);
	if (!match) {
		return undefined;
	}

	const marker = match[1][0];
	return {
		marker,
		length: match[1].length,
		isClosing: match[2].trim().length === 0,
	};
}

/** A file the answer hands over. One loopwise cannot reach stays as the text the model wrote. */
function SavedFileRenderer({ path, children }: any) {
	const label = asText(children);
	const filePath = asText(path);
	if (!isStoredFilePath(filePath)) {
		return <>{label || filePath}</>;
	}

	return <FileChip path={filePath} label={label || undefined} className={styles.savedFileRendererFileChip} />;
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function MarkdownTableRenderer({ node, className }: any) {
	return <MarkdownTable node={node} className={className} />;
}

function CitationNumberRenderer({ id, column, children }: any) {
	return (
		<span className={styles.citationNumberRendererSpan}>
			<CitationPopover
				value={String(children)}
				queryId={stripClobberPrefix(String(id))}
				column={String(column)}
			/>
		</span>
	);
}

function stripClobberPrefix(value: string): string {
	return value.startsWith(CLOBBER_PREFIX) ? value.slice(CLOBBER_PREFIX.length) : value;
}
