import type { ToolResultOutput } from '@ai-sdk/provider-utils';
import type { ReactNode } from 'react';

import { renderToMarkdown } from '../markdown/render-to-markdown.js';

export { DisplayChartOutput } from './display-chart.js';
export { DisplayMapOutput } from './display-map.js';

/** Renders a tool output component to markdown for the model, falling back to JSON if the result is empty. */
export function renderToModelOutput(node: ReactNode, fallback: unknown): ToolResultOutput {
	const markdown = renderToMarkdown(node);
	return { type: 'text', value: markdown || JSON.stringify(fallback) };
}
