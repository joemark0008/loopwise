import styles from './mcp-app-header.module.css';
import type { ReactNode } from 'react';

interface MCPAppHeaderProps {
	title: string;
	children?: ReactNode;
}

export function McpAppHeader({ title, children }: MCPAppHeaderProps) {
	return (
		<header className={styles.mcpAppHeaderHeader}>
			<h1 className={styles.mcpAppHeaderH1}>{title}</h1>
			{children ? <div className={styles.mcpAppHeaderDiv}>{children}</div> : null}
		</header>
	);
}
