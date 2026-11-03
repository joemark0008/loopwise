import { ArrowDownIcon } from 'lucide-react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import styles from './conversation.module.css';
import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
	<StickToBottom
		className={cn(styles.conversationStickToBottom, className)}
		initial='instant'
		resize='instant'
		{...props}
	/>
);

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export const ConversationContent = ({ className, children, ...props }: ConversationContentProps) => (
	<StickToBottom.Content className={cn(styles.conversationContentStickToBottomContent, className)} {...props}>
		{children}
	</StickToBottom.Content>
);

export type ConversationEmptyStateProps = ComponentProps<'div'> & {
	title?: string;
	description?: string;
	icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
	className,
	title = 'No messages yet',
	description = 'Start a conversation to see messages here',
	icon,
	children,
	...props
}: ConversationEmptyStateProps) => (
	<div className={cn(styles.conversationEmptyStateDiv, className)} {...props}>
		{children ?? (
			<>
				{icon && <div className={styles.conversationEmptyStateDiv2}>{icon}</div>}
				<div className={styles.conversationEmptyStateDiv3}>
					<h3 className={styles.conversationEmptyStateH3}>{title}</h3>
					{description && <p className={styles.conversationEmptyStateP}>{description}</p>}
				</div>
			</>
		)}
	</div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({ className, ...props }: ConversationScrollButtonProps) => {
	const { isAtBottom, scrollToBottom } = useStickToBottomContext();

	return (
		!isAtBottom && (
			<Button
				className={cn(styles.conversationScrollButtonButton, className)}
				onClick={() => scrollToBottom()}
				size='icon-sm'
				type='button'
				variant='outline'
				{...props}
			>
				<ArrowDownIcon className={styles.conversationScrollButtonArrowDownIcon} />
			</Button>
		)
	);
};
