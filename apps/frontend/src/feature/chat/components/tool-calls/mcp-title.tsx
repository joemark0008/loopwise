import styles from './mcp-title.module.css';
import type { ReactNode } from 'react';
import { McpServerIcon } from '@/components/mcp-server-icon';

export const McpTitle = ({ server, children }: { server?: string | null; children: ReactNode }) => (
	<span className={styles.mcpTitleSpan}>
		<McpServerIcon server={server} className={styles.mcpTitleMcpServerIcon} />
		{children}
	</span>
);
