import type { ChartType } from './chart-types';
import type { ColumnConditionalFormats } from './conditional-formatting';
import type { KeydownSnapshot, Shortcut } from './keyboard-shortcut';
import type { StoryTheme } from './story-theme';
import type { displayChart } from './tools';
import type { StoryBlockReference } from './types';

/** Bare specifiers a story may import. Everything else is rejected at build time. */
export const STORY_APP_ALLOWED_IMPORTS = [
	'react',
	'react/jsx-runtime',
	'react-dom',
	'react-dom/client',
	'recharts',
	'lucide-react',
	'leaflet',
	'react-leaflet',
	'@loopwise/story-kit',
] as const;

export type StoryAppAllowedImport = (typeof STORY_APP_ALLOWED_IMPORTS)[number];

export const STORY_APP_MANIFEST_PATH = 'loopwise.json';

export const STORY_APP_ENTRY_CANDIDATES = ['app.jsx', 'app.tsx', 'app.js', 'app.ts'] as const;

export const STORY_APP_KINDS = ['react', 'html'] as const;

export type StoryAppKind = (typeof STORY_APP_KINDS)[number];

export type StoryApp = { kind: 'react'; bundle: string } | { kind: 'html'; bundle: string; pageShell: string };

export const isHtmlStoryEntry = (path: string): boolean => {
	return /\.html$/i.test(path);
};

export const STORY_DOCUMENT_SLOTS = { head: '<!--loopwise:head-->', body: '<!--loopwise:body-->' } as const;

export const STORY_HTML_API_GLOBAL = 'loopwise';

export interface StoryHtmlApi {
	query(queryId: string, options?: { fresh?: boolean }): Promise<StoryQueryResult>;
	querySql(queryId: string): Promise<string>;
	narratives(): Promise<StoryNarratives>;
	theme(): StoryTheme | null;
	onTheme(listener: (theme: StoryTheme) => void): () => void;
	isExport(): boolean;
	isPrint(): boolean;
	state: StoryHtmlStateApi;
	sharedState: StoryHtmlStateApi;
}

export interface StoryHtmlStateApi {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
}

export const MAX_STORY_BUNDLE_BYTES = 2 * 1024 * 1024;

export const isAllowedStoryImport = (specifier: string): specifier is StoryAppAllowedImport => {
	return (STORY_APP_ALLOWED_IMPORTS as readonly string[]).includes(specifier);
};

/** Module the frame's bootstrap uses to mount the app and talk to the host; stories cannot import it. */
export const STORY_HOST_MODULE = '@loopwise/story-host';

export const STORY_RUNTIME_PATH = '/story-runtime';

export const STORY_FRAME_ORIGIN = 'null';

export const STORY_FRAME_CORS_HEADERS = {
	'Access-Control-Allow-Origin': STORY_FRAME_ORIGIN,
	'Access-Control-Allow-Private-Network': 'true',
} as const;

/** Bare specifier → file name (without extension) under `STORY_RUNTIME_PATH`. Every import map entry comes from here. */
export const STORY_RUNTIME_MODULES: Record<StoryAppAllowedImport | typeof STORY_HOST_MODULE, string> = {
	react: 'react',
	'react/jsx-runtime': 'react-jsx-runtime',
	'react-dom': 'react-dom',
	'react-dom/client': 'react-dom-client',
	recharts: 'recharts',
	'lucide-react': 'lucide-react',
	leaflet: 'leaflet',
	'react-leaflet': 'react-leaflet',
	'@loopwise/story-kit': 'story-kit',
	[STORY_HOST_MODULE]: 'story-host',
};

export type CustomStoryViewerAccess = { kind: 'sharedChat'; shareId: string } | { kind: 'replay'; chatId: string };

export interface StoryQueryResult {
	columns: string[];
	data: unknown[];
}

/** Narrative id → text regenerated from the latest data */
export type StoryNarratives = Record<string, string>;

export interface StoryExportData {
	queries: Record<string, StoryQueryResult>;
	narratives: StoryNarratives;
	state?: StoryStateSnapshot;
}

/** `user` rows are each viewer's own state; `project` rows are the state every viewer reads and writes together. */
export const STORY_STATE_SCOPES = ['user', 'project'] as const;

export type StoryStateScope = (typeof STORY_STATE_SCOPES)[number];

/** What a custom story saved through `useStoryState`, by key. It outlives versions. */
export type StoryStateValues = Record<string, unknown>;

export interface StoryStateSnapshot {
	shared: StoryStateValues;
	own: StoryStateValues;
}

export interface StoryStateChange {
	key: string;
	value: unknown;
	shared: boolean;
}

export const STORY_STATE_KEY_PATTERN = /^[A-Za-z0-9][\w.:-]{0,99}$/;
export const MAX_STORY_STATE_VALUE_BYTES = 32 * 1024;
export const MAX_STORY_STATE_KEYS = 50;

export const EMPTY_STORY_STATE_SNAPSHOT: StoryStateSnapshot = { shared: {}, own: {} };

/** File under `STORY_RUNTIME_PATH` holding every runtime module in one classic script, for downloaded stories. */
export const STORY_STANDALONE_RUNTIME_FILE = 'standalone.js';

/** Global the standalone runtime fills with each module namespace, keyed by bare specifier. */
export const STORY_STANDALONE_RUNTIME_GLOBAL = '__loopwiseStoryRuntime';

/** Global the PDF renderer sets before a downloaded story boots. */
export const STORY_PRINT_FLAG = '__loopwiseStoryPrint';

/** Set on `<html>` while a printed story lays out a deck: the PDF renderer then prints one slide per page. */
export const STORY_PRINT_SLIDES_ATTRIBUTE = 'data-loopwise-print-slides';

/** Set to the printed Canvas dimensions, as `{width}x{height}`. */
export const STORY_PRINT_CANVAS_ATTRIBUTE = 'data-loopwise-print-canvas';

/** Marks the story's own stylesheets, which the kit rebases on a fixed frame (Slides, Canvas). */
export const STORY_STYLE_ATTRIBUTE = 'data-loopwise-story-style';

/** Container query name of the fixed frames (a Slide, a Canvas surface) the story's own styles are rebased on. */
export const STORY_FRAME_CONTAINER = 'loopwise-frame';

export const STORY_SLIDE_SIZE = { width: 1280, height: 720 } as const;

export const STORY_KIT_NARRATIVE_COMPONENT = 'Narrative';

export type StoryTableExportFormat = 'csv' | 'xlsx';

export const STORY_KIT_EDITABLE_BLOCKS = ['BarChart', 'LineChart', 'Chart', 'KpiCard', 'DataTable'] as const;

export const STORY_KIT_CHART_BLOCKS = ['BarChart', 'LineChart', 'Chart', 'KpiCard'] as const;

export type StoryKitChartBlock = (typeof STORY_KIT_CHART_BLOCKS)[number];

export type StoryKitEditableBlock = (typeof STORY_KIT_EDITABLE_BLOCKS)[number];

export interface StoryKitBlockRef {
	component: StoryKitEditableBlock;
	props: Record<string, unknown>;
}

export type StoryBlockChartConfig = Omit<displayChart.KpiCardInput, 'chart_type'> & {
	chart_type: ChartType;
};

export interface StoryBlockEditRequest {
	block: StoryKitBlockRef & { component: StoryKitChartBlock };
	config: StoryBlockChartConfig;
	columns: string[];
	rows: Record<string, unknown>[];
}

export interface StoryTableFormatEditRequest {
	block: StoryKitBlockRef & { component: 'DataTable' };
	formats: ColumnConditionalFormats;
	columns: string[];
	rows: Record<string, unknown>[];
}

export interface StoryBlockColors {
	palette: string[];
	resolved: Record<string, string>;
}

export interface StoryBlockEditPayload extends StoryBlockEditRequest {
	colors: StoryBlockColors;
}

export interface StoryKitBlockChange {
	component?: StoryKitEditableBlock;
	set: Record<string, unknown>;
	unset: string[];
}

export const isStoryKitEditableBlock = (value: string): value is StoryKitEditableBlock => {
	return (STORY_KIT_EDITABLE_BLOCKS as readonly string[]).includes(value);
};

/** Frame → host. */
export type StoryFrameMessage =
	| { type: 'loopwise-story:ready' }
	| { type: 'loopwise-story:query'; requestId: string; queryId: string; fresh?: boolean }
	| { type: 'loopwise-story:narratives'; requestId: string }
	| { type: 'loopwise-story:error'; message: string; stack?: string }
	| { type: 'loopwise-story:copy-table'; columns: string[]; rows: Record<string, unknown>[] }
	| {
			type: 'loopwise-story:export-table';
			format: StoryTableExportFormat;
			filename: string;
			columns: string[];
			rows: Record<string, unknown>[];
	  }
	| ({ type: 'loopwise-story:edit-block' } & StoryBlockEditPayload)
	| ({ type: 'loopwise-story:edit-table-format' } & StoryTableFormatEditRequest)
	| { type: 'loopwise-story:query-sql'; requestId: string; queryId: string }
	| ({ type: 'loopwise-story:set-state' } & StoryStateChange)
	| { type: 'loopwise-story:ask-block'; block: StoryBlockReference }
	| ({ type: 'loopwise-story:keydown' } & KeydownSnapshot);

/** Plain keys the host hands to the story while it holds focus; everything else needs the story focused. */
export const STORY_FORWARDED_KEYS: readonly string[] = ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'];

/** Host → frame. */
export type StoryHostMessage =
	| { type: 'loopwise-story:query-result'; requestId: string; result: StoryQueryResult }
	| { type: 'loopwise-story:query-error'; requestId: string; message: string }
	| { type: 'loopwise-story:query-sql-result'; requestId: string; sqlQuery: string }
	| { type: 'loopwise-story:query-sql-error'; requestId: string; message: string }
	| { type: 'loopwise-story:narratives-result'; requestId: string; narratives: StoryNarratives }
	| { type: 'loopwise-story:editing'; enabled: boolean }
	| { type: 'loopwise-story:theme'; theme: StoryTheme }
	| { type: 'loopwise-story:shortcuts'; shortcuts: Shortcut[] }
	| ({ type: 'loopwise-story:keydown' } & KeydownSnapshot);

/**
 * Answers the frame's `ready` once, transferring the MessagePort every later message travels on.
 * The port belongs to the story's document, so a document the story navigates to never receives replies.
 */
export const STORY_CONNECT_MESSAGE = 'loopwise-story:connect';

export const isStoryConnectMessage = (value: unknown): boolean => {
	return isStoryMessage(value) && value.type === STORY_CONNECT_MESSAGE;
};

/**
 * A random secret the host embeds in the frame document it builds; the frame stamps it on every message,
 * so a document the story navigated to cannot pass for the story.
 */
export const isFromStoryChannel = (value: unknown, channel: string): boolean => {
	return typeof value === 'object' && value !== null && (value as { channel?: unknown }).channel === channel;
};

export const isStoryFrameMessage = (value: unknown): value is StoryFrameMessage => {
	return (
		isStoryMessage(value) &&
		[
			'loopwise-story:ready',
			'loopwise-story:query',
			'loopwise-story:narratives',
			'loopwise-story:error',
			'loopwise-story:copy-table',
			'loopwise-story:export-table',
			'loopwise-story:edit-block',
			'loopwise-story:edit-table-format',
			'loopwise-story:query-sql',
			'loopwise-story:set-state',
			'loopwise-story:ask-block',
			'loopwise-story:keydown',
		].includes(value.type)
	);
};

export const isStoryHostMessage = (value: unknown): value is StoryHostMessage => {
	return (
		isStoryMessage(value) &&
		[
			'loopwise-story:query-result',
			'loopwise-story:query-error',
			'loopwise-story:query-sql-result',
			'loopwise-story:query-sql-error',
			'loopwise-story:narratives-result',
			'loopwise-story:editing',
			'loopwise-story:theme',
			'loopwise-story:shortcuts',
			'loopwise-story:keydown',
		].includes(value.type)
	);
};

const isStoryMessage = (value: unknown): value is { type: string } => {
	return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
};
