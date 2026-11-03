import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { VoidEntryInput } from '../encounters/dto/encounter-record.input.js';
import { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { SaveMedicalCertificateInput } from './dto/medical-certificate.input.js';
import { MedicalCertificateService } from './medical-certificate.service.js';
import { MedicalCertificate } from './models/medical-certificate.model.js';

/** Medical certificates. Access is row-level security plus the facility check in `MedicalCertificateService`. */
@Resolver(() => MedicalCertificate)
export class MedicalCertificatesResolver {
	constructor(private readonly service: MedicalCertificateService) {}

	@Query(() => MedicalCertificate, { nullable: true, description: 'For printing; null when not in your care.' })
	medicalCertificate(
		@CurrentUser() user: AuthUser,
		@Args('id', { type: () => ID }) id: string,
	): Promise<MedicalCertificate | null> {
		return this.service.get(user.id, id);
	}

	@Mutation(() => MedicalCertificate, { description: 'Creates a draft, or replaces the draft `id`.' })
	saveMedicalCertificate(
		@CurrentUser() user: AuthUser,
		@Args('input') input: SaveMedicalCertificateInput,
	): Promise<MedicalCertificate> {
		return this.service.save(user.id, input);
	}

	@Mutation(() => MedicalCertificate, { description: 'Issues the draft as you; it is locked from then on.' })
	issueMedicalCertificate(
		@CurrentUser() user: AuthUser,
		@Args('id', { type: () => ID }) id: string,
		@Args('wiseOrigin', { type: () => WiseOriginInput, nullable: true }) wiseOrigin?: WiseOriginInput | null,
	): Promise<MedicalCertificate> {
		return this.service.issue(user.id, id, wiseOrigin);
	}

	@Mutation(() => MedicalCertificate)
	voidMedicalCertificate(
		@CurrentUser() user: AuthUser,
		@Args('input') input: VoidEntryInput,
	): Promise<MedicalCertificate> {
		return this.service.void(user.id, input);
	}
}
