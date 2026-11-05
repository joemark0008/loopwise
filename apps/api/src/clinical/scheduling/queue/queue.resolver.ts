import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../../auth/auth.service.js';
import { CurrentUser } from '../../../common/decorators/current.decorator.js';
import { CheckInService } from './check-in.service.js';
import {
	CallNextInput,
	CancelQueueTicketInput,
	CheckInPatientInput,
	QueueTicketsInput,
	SendQueueTicketInput,
} from './dto/queue.input.js';
import { QueueBoard, QueueTicket } from './models/queue-ticket.model.js';
import { QueueService } from './queue.service.js';
import { VisitFlowService } from './visit-flow.service.js';

/**
 * The clinic's queue: check-in at the front desk, the stations' lines (triage, each doctor's room, the cashier) and
 * the waiting-room board. Each station is worked by its desk; clinic admins work every desk.
 */
@Resolver(() => QueueTicket)
export class QueueResolver {
	constructor(
		private readonly queue: QueueService,
		private readonly checkIns: CheckInService,
		private readonly flow: VisitFlowService,
	) {}

	@Query(() => [QueueTicket], { description: "A day's queue at one of your clinics (priority lane first)." })
	queueTickets(@CurrentUser() user: AuthUser, @Args('input') input: QueueTicketsInput): Promise<QueueTicket[]> {
		return this.queue.list(user.id, input);
	}

	@Query(() => QueueBoard, { description: "Today's waiting-room board: numbers and stations, no names." })
	queueBoard(
		@CurrentUser() user: AuthUser,
		@Args('clinicId', { type: () => ID }) clinicId: string,
	): Promise<QueueBoard> {
		return this.queue.board(user.id, clinicId);
	}

	@Mutation(() => QueueTicket, { description: 'Checks a patient in: opens the visit and issues the queue number.' })
	checkInPatient(@CurrentUser() user: AuthUser, @Args('input') input: CheckInPatientInput): Promise<QueueTicket> {
		return this.checkIns.checkIn(user.id, input);
	}

	@Mutation(() => QueueTicket, { nullable: true, description: 'Calls the next patient at a station; null if none.' })
	callNextQueueTicket(
		@CurrentUser() user: AuthUser,
		@Args('input') input: CallNextInput,
	): Promise<QueueTicket | null> {
		return this.queue.callNext(user.id, input);
	}

	@Mutation(() => QueueTicket, { description: 'Calls one waiting patient (out of turn, or again).' })
	callQueueTicket(
		@CurrentUser() user: AuthUser,
		@Args('ticketId', { type: () => ID }) ticketId: string,
	): Promise<QueueTicket> {
		return this.queue.call(user.id, ticketId);
	}

	@Mutation(() => QueueTicket, {
		description: "The patient is at the station; at the doctor's room the visit starts.",
	})
	startQueueTicket(
		@CurrentUser() user: AuthUser,
		@Args('ticketId', { type: () => ID }) ticketId: string,
	): Promise<QueueTicket> {
		return this.flow.start(user.id, ticketId);
	}

	@Mutation(() => QueueTicket, {
		description: 'Sends the patient on: triage → the doctor, the doctor → the cashier.',
	})
	sendQueueTicket(@CurrentUser() user: AuthUser, @Args('input') input: SendQueueTicketInput): Promise<QueueTicket> {
		return this.flow.send(user.id, input);
	}

	@Mutation(() => QueueTicket, {
		description: 'The patient is done (at the cashier, or the doctor with nothing to bill).',
	})
	completeQueueTicket(
		@CurrentUser() user: AuthUser,
		@Args('ticketId', { type: () => ID }) ticketId: string,
	): Promise<QueueTicket> {
		return this.flow.complete(user.id, ticketId);
	}

	@Mutation(() => QueueTicket, { description: 'Not there when called.' })
	skipQueueTicket(
		@CurrentUser() user: AuthUser,
		@Args('ticketId', { type: () => ID }) ticketId: string,
	): Promise<QueueTicket> {
		return this.queue.skip(user.id, ticketId);
	}

	@Mutation(() => QueueTicket, { description: 'A skipped patient is back in line, keeping the number.' })
	requeueQueueTicket(
		@CurrentUser() user: AuthUser,
		@Args('ticketId', { type: () => ID }) ticketId: string,
	): Promise<QueueTicket> {
		return this.queue.requeue(user.id, ticketId);
	}

	@Mutation(() => QueueTicket, {
		description: 'The patient left before the doctor: cancels the ticket and the visit.',
	})
	cancelQueueTicket(
		@CurrentUser() user: AuthUser,
		@Args('input') input: CancelQueueTicketInput,
	): Promise<QueueTicket> {
		return this.flow.cancel(user.id, input);
	}
}
