import {
	ALL_DATABASE_CONTEXT_ACCESS,
	ALL_DOCS_CONTEXT_ACCESS,
	ALL_FILES_CONTEXT_ACCESS,
	serializeUserGroupContextAccess,
} from '@quarry/shared/user-group-context';
import {
	DEFAULT_TOOL_CALL_DENSITY_POLICY,
	DEFAULT_USER_GROUP_NAME,
	serializeUserGroupConfig,
	USER_GROUP_FEATURES,
} from '@quarry/shared/user-group-features';
import { ALL_MCP_ACCESS } from '@quarry/shared/user-group-mcp';
import { ALL_SKILLS_ACCESS } from '@quarry/shared/user-group-skills';

import type { Prisma } from '../generated/prisma/client.js';

/** The "All Users" group every project gets on creation (upstream `defaultUserGroupValues`). */
export const defaultUserGroupValues = (projectId: string): Prisma.UserGroupUncheckedCreateInput => ({
	projectId,
	name: DEFAULT_USER_GROUP_NAME,
	isDefault: true,
	featureGrants: serializeUserGroupConfig(
		USER_GROUP_FEATURES,
		DEFAULT_TOOL_CALL_DENSITY_POLICY,
		'inherit',
		true,
	) as Prisma.InputJsonValue,
	contextGrants: serializeUserGroupContextAccess({
		databaseAccess: ALL_DATABASE_CONTEXT_ACCESS,
		docsAccess: ALL_DOCS_CONTEXT_ACCESS,
		filesAccess: ALL_FILES_CONTEXT_ACCESS,
		mcpAccess: ALL_MCP_ACCESS,
		skillsAccess: ALL_SKILLS_ACCESS,
	}) as unknown as Prisma.InputJsonValue,
});
