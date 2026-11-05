import { Args, Int, Query, Resolver } from '@nestjs/graphql';

import { ClinicAdmin } from '../../../common/decorators/access.decorator.js';
import { HandlerError } from '../../../common/errors/handler-error.js';
import { type ClinicActor, CurrentClinicActor } from '../clinic-admin-actor.js';
import { EXPIRY_WARNING_DAYS } from './credential-expiry.js';
import { CredentialExpiryService } from './credential-expiry.service.js';
import { ExpiringCredential } from './models/expiring-credential.model.js';

/** Settings → Clinic → Expiring licenses (clinic admins). */
@Resolver(() => ExpiringCredential)
export class CredentialExpiryResolver {
	constructor(private readonly expiries: CredentialExpiryService) {}

	@ClinicAdmin()
	@Query(() => [ExpiringCredential], {
		description: 'Licenses and accreditations of the selected clinic and its practitioners expiring soon.',
	})
	expiringCredentials(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('withinDays', { type: () => Int, defaultValue: EXPIRY_WARNING_DAYS }) withinDays: number,
	): Promise<ExpiringCredential[]> {
		if (withinDays < 0 || withinDays > 366) {
			throw new HandlerError('BAD_REQUEST', 'withinDays is between 0 and 366.');
		}
		return this.expiries.list(actor, withinDays);
	}
}
