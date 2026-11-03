import * as React from 'react';
import { Link as RouterLink } from '@tanstack/react-router';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import styles from './link.module.css';
import type { LinkProps } from '@tanstack/react-router';

interface CustomLinkProps extends LinkProps {
	className?: string;
	onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
	onDoubleClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const Link = forwardRef<HTMLAnchorElement, CustomLinkProps>(
	({ className, onClick, onDoubleClick, ...props }, ref) => {
		return (
			<RouterLink
				ref={ref}
				{...props}
				className={cn(styles.linkRouterLink, className)}
				onClick={onClick}
				onDoubleClick={onDoubleClick}
			/>
		);
	},
);

Link.displayName = 'Link';
