import { applyDecorators, type CanActivate, type ExecutionContext, Injectable, UseGuards } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { getRequest } from '../common/request.js';
import { FacilityKeyService } from './facility-key.service.js';
import { readBearerFacilityKey } from './facility-key-token.js';

/**
 * Authenticates a facility (not a user) by its `Authorization: Bearer lw_…` key and sets `request.facility`
 * (`@CurrentFacility()`). Unknown, revoked or missing keys get 401.
 */
@Injectable()
export class FacilityKeyGuard implements CanActivate {
	constructor(private readonly keys: FacilityKeyService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = getRequest(context);
		const key = readBearerFacilityKey(req.headers.authorization);
		const facility = key ? await this.keys.authenticate(key) : null;
		if (!facility) {
			throw new HandlerError('UNAUTHORIZED', 'Invalid facility key');
		}
		req.facility = facility;
		return true;
	}
}

/**
 * A machine endpoint for facility systems: no user session (the global `AuthGuard` lets it through as public), a
 * facility key instead. Import `FacilityKeysModule` in the controller's module.
 */
export const FacilityKey = () => applyDecorators(Public(), UseGuards(FacilityKeyGuard));
