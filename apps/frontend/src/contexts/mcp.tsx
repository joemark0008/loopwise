import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { McpServerStatus } from '@loopwise/shared';

interface McpContextValue {
	servers: McpServerStatus[] | undefined;
	configError: string | null;
	refresh: () => Promise<void>;
}

/**
 * MCP server connections come back with Phase 7 (`docs/deferred-features.md`). Until then the clinic has no
 * MCP servers; tool-call views that look servers up for icons and labels fall back to their defaults.
 */
const NO_MCP_SERVERS: McpContextValue = { servers: [], configError: null, refresh: async () => {} };

const McpContext = createContext<McpContextValue | null>(null);

export function McpProvider({ children }: { children: ReactNode }) {
	return <McpContext.Provider value={NO_MCP_SERVERS}>{children}</McpContext.Provider>;
}

export function useMcpContext() {
	const context = useContext(McpContext);
	if (!context) {
		throw new Error('useMcpContext must be used within McpProvider');
	}
	return context;
}
