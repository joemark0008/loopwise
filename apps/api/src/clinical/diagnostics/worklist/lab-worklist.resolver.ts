import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../../auth/auth.service.js';
import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { CurrentClinic, CurrentUser } from '../../../common/decorators/current.decorator.js';
import type { Clinic } from '../../../generated/prisma/client.js';
import { LAB_DESK_ROLES } from '../lab-desk-access.js';
import { DiagnosticOrderStatus } from '../models/diagnostic-enums.js';
import {
	DiagnosticItemStepInput,
	EnterDiagnosticResultInput,
	MarkSpecimenCollectedInput,
} from './dto/lab-worklist.input.js';
import { LabWorklistService } from './lab-worklist.service.js';
import { LabWorklistCount, LabWorklistItem } from './models/lab-worklist.model.js';

/**
 * The clinic's lab desk. The queries need the selected clinic and a lab role there (`@ClinicAccess`); the steps check
 * the test's own clinic in `LabWorklistService`.
 */
@Resolver(() => LabWorklistItem)
export class LabWorklistResolver {
	constructor(private readonly worklist: LabWorklistService) {}

	@ClinicAccess({ staffRoles: LAB_DESK_ROLES })
	@Query(() => [LabWorklistItem], {
		description: "The clinic's tests at these steps (default: every step before release), STAT first then oldest.",
	})
	labWorklist(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@Args('statuses', { type: () => [DiagnosticOrderStatus], nullable: true })
		statuses?: DiagnosticOrderStatus[] | null,
	): Promise<LabWorklistItem[]> {
		return this.worklist.list(user.id, clinic.id, statuses?.length ? statuses : undefined);
	}

	@ClinicAccess({ staffRoles: LAB_DESK_ROLES })
	@Query(() => [LabWorklistCount], { description: 'How many tests each worklist tab holds.' })
	labWorklistCounts(@CurrentUser() user: AuthUser, @CurrentClinic() clinic: Clinic): Promise<LabWorklistCount[]> {
		return this.worklist.counts(user.id, clinic.id);
	}

	@Mutation(() => LabWorklistItem, { description: 'The specimen was taken (with its accession number).' })
	markSpecimenCollected(
		@CurrentUser() user: AuthUser,
		@Args('input') input: MarkSpecimenCollectedInput,
	): Promise<LabWorklistItem> {
		return this.worklist.collect(user.id, input);
	}

	@Mutation(() => LabWorklistItem, {
		description: 'The run started (the specimen is on the analyser, the study is on).',
	})
	startDiagnosticOrderItem(
		@CurrentUser() user: AuthUser,
		@Args('input') input: DiagnosticItemStepInput,
	): Promise<LabWorklistItem> {
		return this.worklist.start(user.id, input.itemId, input.wiseOrigin);
	}

	@Mutation(() => LabWorklistItem, {
		description: 'Enters the result of a test (values flagged from their reference range, or an imaging report).',
	})
	enterDiagnosticResult(
		@CurrentUser() user: AuthUser,
		@Args('input') input: EnterDiagnosticResultInput,
	): Promise<LabWorklistItem> {
		return this.worklist.enterResult(user.id, input);
	}

	@Mutation(() => LabWorklistItem, { description: "Releases the entered result to the requesting doctor's inbox." })
	releaseDiagnosticResult(
		@CurrentUser() user: AuthUser,
		@Args('input') input: DiagnosticItemStepInput,
	): Promise<LabWorklistItem> {
		return this.worklist.release(user.id, input.itemId, input.wiseOrigin);
	}
}
