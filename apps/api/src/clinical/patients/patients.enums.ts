import { registerEnumType } from '@nestjs/graphql';

import { AllergyType, IdentificationType, Severity, Sex } from '../../generated/prisma/enums.js';

registerEnumType(Sex, { name: 'Sex' });
registerEnumType(IdentificationType, { name: 'IdentificationType' });
registerEnumType(AllergyType, { name: 'AllergyType' });
registerEnumType(Severity, { name: 'Severity' });

/** Why a registration may duplicate an existing patient of the organization. */
export enum DuplicateMatch {
	/** The patient number or the PhilHealth number in the organization: never registered twice. */
	EXACT_IDENTIFIER = 'EXACT_IDENTIFIER',
	/** Same name, birth date and sex: possibly the same person; the clinician decides. */
	NAME_BIRTH_SEX = 'NAME_BIRTH_SEX',
}

registerEnumType(DuplicateMatch, { name: 'DuplicateMatch' });

export { AllergyType, IdentificationType, Severity, Sex };
