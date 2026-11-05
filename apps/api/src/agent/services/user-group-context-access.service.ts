import type { McpAccess, UserGroupFeature, WarehouseRowSecurity } from '@loopwise/shared';
import { ALL_MCP_ACCESS, type FileTreeAccess, USER_GROUP_FEATURES } from '@loopwise/shared';
import type { UserRulesGroupAccess } from '@loopwise/shared/rules-template';

import type { WarehouseTableAccess } from './context-access.js';

/** Types of upstream `services/user-group-context-access.service.ts`. */
export type ResolvedFileTreeAccess = { enforced: false } | { enforced: true; access: FileTreeAccess };
export type ResolvedDocsContextAccess = ResolvedFileTreeAccess;
export type ResolvedFilesContextAccess = ResolvedFileTreeAccess;
export type ResolvedSkillsAccess = { mode: 'all' } | { mode: 'restricted'; skills: string[]; grantedFiles: string[] };

export interface ClinicContextAccess {
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
 * What a clinic member may reach. User groups (which narrow tables, docs, MCP servers, skills and rows) are
 * Phase 6; until then every member of the clinic gets the full context, as upstream's default "All Users" group.
 */
export function fullClinicContextAccess(): ClinicContextAccess {
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
