import { ClinicAccess } from '../common/decorators/access.decorator.js';

/** Clinic admins and context admins (upstream `contextAdminProtectedProcedure`; its billing variants are dropped). */
export const ClinicContextAdmin = () => ClinicAccess({ roles: ['admin', 'context_admin'] });
