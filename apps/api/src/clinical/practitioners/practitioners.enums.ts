import { registerEnumType } from '@nestjs/graphql';

import { PractitionerType } from '../../generated/prisma/enums.js';

registerEnumType(PractitionerType, { name: 'PractitionerType' });

export { PractitionerType };
