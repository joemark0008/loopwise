import { registerEnumType } from '@nestjs/graphql';

import { OrgRole, StaffRole } from '../../generated/prisma/enums.js';

registerEnumType(StaffRole, {
	name: 'StaffRole',
	description: 'A role a user holds at a clinic (`user_clinic_roles`); a user holds one row per role.',
});

registerEnumType(OrgRole, {
	name: 'OrgRole',
	description: "A user's role in an organization (`organization_members`).",
});

export { OrgRole, StaffRole };
