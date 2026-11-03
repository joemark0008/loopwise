import type { McpAccess, UserGroupFeature, WarehouseRowSecurity } from '@quarry/shared';
import { ALL_MCP_ACCESS, type FileTreeAccess, USER_GROUP_FEATURES } from '@quarry/shared';
import type { UserRulesGroupAccess } from '@quarry/shared/rules-template';

import type { WarehouseTableAccess } from './context-access.js';

/** Types of upstream `services/user-group-context-access.service.ts`. */
export type ResolvedFileTreeAccess = { enforced: false } | { enforced: true; access: FileTreeAccess };
export type ResolvedDocsContextAccess = ResolvedFileTreeAccess;
export type ResolvedFilesContextAccess = ResolvedFileTreeAccess;
export type ResolvedSkillsAccess = { mode: 'all' } | { mode: 'restricted'; skills: string[]; grantedFiles: string[] };

export interface ProjectContextAccess {
	warehouseTableAccess: WarehouseTableAccess;
	warehouseRowSecurity: WarehouseRowSecurity;
	docsContextAccess: ResolvedDocsContextAccess;
	filesContextAccess: ResolvedFilesContextAccess;
	mcpAccess: McpAccess;
	skillsAccess: ResolvedSkillsAccess;
	userGroupFeatures: UserGroupFeature[];
	userRulesGroupAccess: UserRulesGroupAccess;
	preloadedSkillNames: string[];
}

/**
 * What a project member may reach. User groups (which narrow tables, docs, MCP servers, skills and rows) are
 * Phase 6; until then every member of the project gets the full context, as upstream's default "All Users" group.
 */
export function fullProjectContextAccess(): ProjectContextAccess {
	return {
		warehouseTableAccess: { enforced: false },
		warehouseRowSecurity: { enforced: false },
		docsContextAccess: { enforced: false },
		filesContextAccess: { enforced: false },
		mcpAccess: ALL_MCP_ACCESS,
		skillsAccess: { mode: 'all' },
		userGroupFeatures: [...USER_GROUP_FEATURES],
		userRulesGroupAccess: { enforced: false },
		preloadedSkillNames: [],
	};
}
