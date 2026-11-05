import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAdmin } from '../../../common/decorators/access.decorator.js';
import { type ClinicActor, CurrentClinicActor } from '../clinic-admin-actor.js';
import { DocumentSequenceSettingsService } from './document-sequence-settings.service.js';
import { DocumentSequenceSetting, SetDocumentSequenceInput } from './models/document-sequence-setting.model.js';

/** Settings → Clinic → Numbering (clinic admins). */
@Resolver(() => DocumentSequenceSetting)
export class DocumentSequenceSettingsResolver {
	constructor(private readonly settings: DocumentSequenceSettingsService) {}

	@ClinicAdmin()
	@Query(() => [DocumentSequenceSetting], { description: "The selected clinic's document numbering this year." })
	documentSequences(@CurrentClinicActor() actor: ClinicActor): Promise<DocumentSequenceSetting[]> {
		return this.settings.list(actor);
	}

	@ClinicAdmin()
	@Mutation(() => DocumentSequenceSetting, { description: "Sets a document's prefix and padding (audited)." })
	setDocumentSequence(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: SetDocumentSequenceInput,
	): Promise<DocumentSequenceSetting> {
		return this.settings.set(actor, input);
	}
}
