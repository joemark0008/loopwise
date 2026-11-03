import 'prompt-mentions/style.css';

import { useQuery } from '@tanstack/react-query';
import { SKILL_MENTION_TRIGGER } from '@loopwise/shared';
import { Prompt } from 'prompt-mentions';
import styles from './chat-input-prompt.module.css';
import type { PromptHandle, PromptTheme, SelectedMention } from 'prompt-mentions';
import type { RefObject } from 'react';
import { useActiveProjectId } from '@/lib/active-project';
import { cn } from '@/lib/utils';
import { skillApi } from '@/lib/skill-api';
import { useCurrentProject } from '@/hooks/use-current-project';

export { SKILL_MENTION_TRIGGER };

type ChatPromptProps = {
	promptRef: RefObject<PromptHandle | null>;
	placeholder: string;
	initialValue?: string;
	minHeight?: string;
	resizable?: boolean;
	submitOnEnter?: boolean;
	onChange: (value: string, mentions: SelectedMention[]) => void;
	onEnter?: (value: string, mentions: SelectedMention[]) => void;
};

const theme: PromptTheme = {
	backgroundColor: 'transparent',
	placeholderColor: 'var(--app-muted)',
	borderColor: 'transparent',
	focusBorderColor: 'transparent',
	focusBoxShadow: 'none',
	minHeight: '70px',
	color: 'var(--app-text)',
	padding: '12px',
	fontFamily: 'inherit',
	fontSize: '14px',
	menu: {
		minWidth: '400px',
		maxHeight: '360px',
		backgroundColor: 'var(--app-surface)',
		borderColor: 'var(--app-line)',
		color: 'var(--app-text)',
		itemHoverColor: 'var(--app-fill)',
		chevronColor: 'var(--app-muted)',
		chevronHoverColor: 'var(--app-text)',
		title: {
			labelColor: 'var(--app-muted)',
		},
	},
	pill: {
		backgroundColor: 'var(--app-surface)',
		color: 'var(--app-text)',
		padding: 'calc(var(--spacing) * 1) calc(var(--spacing) * 2.5)',
		borderRadius: '9999px',
	},
};

export function ChatPrompt({
	promptRef,
	placeholder,
	initialValue,
	minHeight,
	resizable = false,
	submitOnEnter = true,
	onChange,
	onEnter,
}: ChatPromptProps) {
	const activeProjectId = useActiveProjectId();
	const project = useCurrentProject();
	const projectId = project.data?.id;
	const hasProject = projectId != null && (!activeProjectId || activeProjectId === projectId);
	const skillsQuery = useQuery({
		...skillApi.skill.list.queryOptions(),
		enabled: hasProject,
	});
	const skills = hasProject && !skillsQuery.isFetching ? skillsQuery.data : undefined;
	const promptTheme = minHeight ? { ...theme, minHeight } : theme;

	return (
		<Prompt
			ref={promptRef}
			initialValue={initialValue}
			placeholder={placeholder}
			mentionConfigs={[
				{
					trigger: SKILL_MENTION_TRIGGER,
					menuPosition: 'above',
					options: [
						...(skills?.map((skill) => ({
							id: skill.name,
							label: skill.name,
							labelRight: skill.description ?? undefined,
							icon: <span>{SKILL_MENTION_TRIGGER}</span>,
						})) ?? []),
					],
				},
			]}
			onChange={onChange}
			onEnter={onEnter}
			submitOnEnter={submitOnEnter}
			className={cn(`${styles.chatPromptPrompt} loopwise-input`, resizable && 'loopwise-input-resizable')}
			style={
				{
					'--prompt-min-height': minHeight || '70px',
				} as React.CSSProperties
			}
			theme={promptTheme}
		/>
	);
}

/** Puts the trigger at the end of the input and opens its menu, whatever the caret was. */
export function openMentionMenuAtEnd(prompt: PromptHandle, trigger: string) {
	prompt.focus();
	if (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable) {
		placeCaretAtEnd(document.activeElement);
	}
	const value = prompt.getValue();
	prompt.insertText(value.length > 0 && !/\s$/.test(value) ? ` ${trigger}` : trigger);
}

function placeCaretAtEnd(editor: HTMLElement) {
	const range = document.createRange();
	if (editor.lastChild?.nodeName === 'BR') {
		range.setStartBefore(editor.lastChild);
	} else {
		range.selectNodeContents(editor);
		range.collapse(false);
	}
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}
