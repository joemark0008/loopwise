import { renderToMarkdown } from '../markdown/index.js';
import { SystemPrompt } from './system-prompt.js';

/** Renders upstream's `SystemPrompt` component to the markdown sent to the model. */
export function renderSystemPrompt(props: Parameters<typeof SystemPrompt>[0]): string {
	return renderToMarkdown(SystemPrompt(props));
}
