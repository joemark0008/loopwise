import { createContext, useContext } from 'react';

export interface QueryWorkbenchActions {
	/** The SQL in the editor right now. */
	sql: string;
	/** Replaces the editor's SQL, which stays undoable with ⌘Z, and selects the query's connection if it has one. */
	applySql: (sql: string, databaseId?: string) => void;
}

export const QueryWorkbenchContext = createContext<QueryWorkbenchActions | null>(null);

/** The query workbench around a chat message, or null anywhere else. */
export const useQueryWorkbench = () => useContext(QueryWorkbenchContext);
