import { useState } from 'react';
import styles from './default.module.css';
import type { ToolCallComponentProps } from '.';
import { getToolName } from '@/lib/ai';
import { Spinner } from '@/components/ui/spinner';
import { Expandable } from '@/components/ui/expandable';
import { useToolCallContext } from '@/contexts/tool-call';

export const DefaultToolCall = ({ toolPart }: ToolCallComponentProps) => {
	const [isExpanded, setIsExpanded] = useState(false);
	const canExpand = !!toolPart.errorText || !!toolPart.output;
	const { isSettled } = useToolCallContext();
	const toolName = getToolName(toolPart);
	const title = toolName;

	const statusIcon = isSettled ? undefined : <Spinner className={styles.statusIconSpinner} />;

	return (
		<Expandable
			title={title}
			expanded={isExpanded}
			onExpandedChange={setIsExpanded}
			disabled={!canExpand}
			isLoading={!isSettled}
			leadingIcon={statusIcon}
		>
			{toolPart.errorText ? (
				<pre className={styles.defaultToolCallPre}>{toolPart.errorText}</pre>
			) : toolPart.output ? (
				<pre className={styles.defaultToolCallPre2}>{JSON.stringify(toolPart.output, null, 2)}</pre>
			) : null}
		</Expandable>
	);
};
