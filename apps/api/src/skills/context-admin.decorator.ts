import { ProjectAccess } from '../common/decorators/access.decorator.js';

/** Project admins and context admins (upstream `contextAdminProtectedProcedure`; its billing variants are dropped). */
export const ProjectContextAdmin = () => ProjectAccess({ roles: ['admin', 'context_admin'] });
