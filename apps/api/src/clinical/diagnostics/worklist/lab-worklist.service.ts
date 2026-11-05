import type { listLabOrders } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError, InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import type { DiagnosticOrderStatus, OrderPriority } from '../../../generated/prisma/enums.js';
import { AuditService } from '../../audit/audit.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import type { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';
import { WiseProposalService } from '../../wise-proposals/wise-proposal.service.js';
import type { ItemRow } from '../diagnostic.includes.js';
import { ResultContentRequiredError } from '../diagnostics.errors.js';
import { LabDeskAccess } from '../lab-desk-access.js';
import { practitionerName } from '../models/diagnostic-result.model.js';
import { DiagnosticOrderRepository } from '../orders/diagnostic-order.repository.js';
import { DiagnosticOrderTransitions } from '../orders/diagnostic-order-transitions.service.js';
import type { EnterDiagnosticResultInput, MarkSpecimenCollectedInput } from './dto/lab-worklist.input.js';
import { LabWorklistRepository } from './lab-worklist.repository.js';
import { type LabWorklistCount, type LabWorklistItem, toLabWorklistItem } from './models/lab-worklist.model.js';
import { buildResultValues } from './result-values.js';

/** The worklist tabs: the steps before release. */
export const LAB_WORKLIST_STATUSES = [
	'REQUESTED',
	'PAID',
	'SPECIMEN_COLLECTED',
	'IN_PROGRESS',
	'RESULTED',
] as const satisfies readonly DiagnosticOrderStatus[];

const WORKLIST_LIMIT = 500;
const PRIORITY_RANK: Record<OrderPriority, number> = { STAT: 0, URGENT: 1, ROUTINE: 2 };

/** Where each lab step may start from (the status machine allows more; these are the desk's own steps). */
const STEP_FROM = {
	collect: ['REQUESTED', 'PAID'],
	start: ['REQUESTED', 'PAID', 'SPECIMEN_COLLECTED'],
	release: ['RESULTED'],
} as const satisfies Record<string, readonly DiagnosticOrderStatus[]>;

/**
 * The clinic's lab desk (in-house laboratory and imaging, run by MEDTECH / RADTECH staff): the worklist of tests by
 * step, STAT first then oldest; marking the specimen collected (accession number, who took it), starting the run,
 * entering results (values flagged against the parameter's sex-specific reference range) and releasing them to the
 * requesting doctor. Every step goes through `DiagnosticOrderTransitions` and writes an audit row; a released result
 * corrected later goes back through IN_PROGRESS and must be released, and reviewed, again.
 */
@Injectable()
export class LabWorklistService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly worklist: LabWorklistRepository,
		private readonly orders: DiagnosticOrderRepository,
		private readonly transitions: DiagnosticOrderTransitions,
		private readonly labDesk: LabDeskAccess,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** The clinic's tests at these steps, STAT first then oldest; one audit row per patient listed. */
	async list(
		userId: string,
		clinicId: string,
		statuses: readonly DiagnosticOrderStatus[] = LAB_WORKLIST_STATUSES,
	): Promise<LabWorklistItem[]> {
		await this.labDesk.assert(userId, clinicId);
		return this.db.asUser(userId, async (tx) => {
			const rows = await this.worklist.listItems(tx, [clinicId], statuses, WORKLIST_LIMIT);
			await this.auditListed(tx, userId, rows, 'lab_worklist.list');
			return sortForDesk(rows).map(toLabWorklistItem);
		});
	}

	/** How many tests each worklist tab holds. */
	async counts(userId: string, clinicId: string): Promise<LabWorklistCount[]> {
		await this.labDesk.assert(userId, clinicId);
		const groups = await this.db.asUser(userId, (tx) => this.worklist.countByStatus(tx, [clinicId]));
		return LAB_WORKLIST_STATUSES.map((status) => ({
			status,
			count: groups.find((group) => group.status === status)?.count ?? 0,
		}));
	}

	/** The specimen was taken: SPECIMEN_COLLECTED, with its accession number and who took it. */
	collect(userId: string, input: MarkSpecimenCollectedInput): Promise<LabWorklistItem> {
		return this.step(userId, input.itemId, 'collect', input.wiseOrigin, async (tx, item) => {
			const accessionNo = input.accessionNo?.trim() || `${item.order.orderNo}-${item.test.code}`;
			await this.transitions.moveItem(tx, item, 'SPECIMEN_COLLECTED', {
				accessionNo,
				specimenCollectedAt: new Date(),
				collectedById: userId,
			});
			return { event: 'diagnostic_order.collect', after: { status: 'SPECIMEN_COLLECTED', accessionNo } };
		});
	}

	/** The run started (an imaging study, or a specimen on the analyser): IN_PROGRESS. */
	start(userId: string, itemId: string, wiseOrigin?: WiseOriginInput | null): Promise<LabWorklistItem> {
		return this.step(userId, itemId, 'start', wiseOrigin, async (tx, item) => {
			await this.transitions.moveItem(tx, item, 'IN_PROGRESS');
			return { event: 'diagnostic_order.start', after: { status: 'IN_PROGRESS' } };
		});
	}

	/**
	 * The result is checked and goes to the requesting doctor's results inbox: RELEASED, with who verified it. Critical
	 * values reach the doctor here; they never trigger an automated message to the patient.
	 */
	release(userId: string, itemId: string, wiseOrigin?: WiseOriginInput | null): Promise<LabWorklistItem> {
		return this.step(userId, itemId, 'release', wiseOrigin, async (tx, item) => {
			if (!item.result) {
				throw new ResultContentRequiredError();
			}
			await this.transitions.moveItem(tx, item, 'RELEASED');
			await this.worklist.markReleased(tx, item.result.id, userId, new Date());
			return { event: 'diagnostic_result.release', action: 'SIGN', after: { status: 'RELEASED' } };
		});
	}

	/**
	 * Enters (or replaces) a test's result: values checked against the test's parameters and flagged from their
	 * reference range for the patient's sex, or the findings and impression of an imaging report. The test becomes
	 * RESULTED; a released result being corrected goes back through IN_PROGRESS and must be released again, and its
	 * review is cleared.
	 */
	async enterResult(userId: string, input: EnterDiagnosticResultInput): Promise<LabWorklistItem> {
		return this.db.asUser(userId, async (tx) => {
			const item = await this.labItem(tx, userId, input.itemId);
			const values = buildResultValues(item.test.parameters, item.order.encounter.patient.sex, input.values);
			const findings = input.findings?.trim() || null;
			const impression = input.impression?.trim() || null;
			if (values.length === 0 && !findings && !impression) {
				throw new ResultContentRequiredError();
			}
			if (item.status === 'CANCELLED') {
				throw new InvalidStatusTransitionError('DiagnosticOrderItem', item.status, 'RESULTED');
			}
			const correcting = item.status === 'RELEASED';
			if (correcting) {
				await this.transitions.moveItem(tx, item, 'IN_PROGRESS');
			}
			if (item.status !== 'RESULTED') {
				await this.transitions.moveItem(
					tx,
					{ ...item, status: correcting ? 'IN_PROGRESS' : item.status },
					'RESULTED',
				);
			}
			const before = item.result
				? item.result.values.map(({ name, value, flag }) => ({ name, value, flag }))
				: null;
			const resultId = await this.worklist.saveResult(
				tx,
				item.id,
				item.result?.id ?? null,
				{
					performedById: userId,
					findings,
					impression,
					remarks: input.remarks?.trim() || null,
					resultedAt: new Date(),
				},
				values,
			);
			const entry = {
				event: correcting ? 'diagnostic_result.correct' : 'diagnostic_result.enter',
				entityType: 'DiagnosticResult',
				entityId: resultId,
				userId,
				...this.scope(item),
				changes: {
					before: before ? { values: before } : null,
					after: {
						values: values.map(({ name, value, flag }) => ({ name, value, flag })),
						findings,
						impression,
					},
				},
				reason: correcting ? (input.remarks?.trim() ?? null) : null,
			};
			await (item.result ? this.audit.updated(tx, entry) : this.audit.created(tx, entry));
			return toLabWorklistItem((await this.orders.findItem(tx, item.id))!);
		});
	}

	/** Wise's `list_lab_orders`: the worklist of the chat's clinic, as the user, STAT first then oldest. */
	async labWorklistForWise(
		userId: string,
		clinicId: string,
		opts: { statuses: readonly DiagnosticOrderStatus[]; limit: number },
	): Promise<{ orders: listLabOrders.Order[]; truncated: boolean }> {
		await this.labDesk.assert(userId, clinicId);
		return this.db.asUser(userId, async (tx) => {
			const rows = sortForDesk(await this.worklist.listItems(tx, [clinicId], opts.statuses, WORKLIST_LIMIT));
			const listed = rows.slice(0, opts.limit);
			await this.auditListed(tx, userId, listed, 'lab_worklist.list', 'Wise list_lab_orders');
			return {
				truncated: rows.length > listed.length,
				orders: listed.map((row) => {
					const patient = row.order.encounter.patient;
					return {
						id: row.id,
						orderNo: row.order.orderNo,
						test: row.test.name,
						category: row.test.category,
						priority: row.order.priority,
						status: row.status,
						clinicalInfo: row.order.clinicalInfo,
						accessionNo: row.accessionNo,
						orderedAt: row.order.createdAt.toISOString(),
						patient: {
							name: `${patient.firstName} ${patient.lastName}`,
							patientNo: patient.patientNo,
							birthDate: patient.birthDate.toISOString().slice(0, 10),
							sex: patient.sex,
						},
						requestedBy: row.order.requestedBy
							? practitionerName(row.order.requestedBy)
							: (row.order.externalPhysician ?? 'Not stated'),
					};
				}),
			};
		});
	}

	/**
	 * One lab step on one test, as the user: the test must be at the user's lab desk and at a status the step starts
	 * from; a Wise card is verified against the visit's organization and settled in the same transaction as the move and its audit
	 * row.
	 */
	private step(
		userId: string,
		itemId: string,
		step: keyof typeof STEP_FROM,
		wiseOrigin: WiseOriginInput | null | undefined,
		apply: (
			tx: ClinicalTx,
			item: ItemRow,
		) => Promise<{ event: string; action?: 'UPDATE' | 'SIGN'; after: Record<string, string> }>,
	): Promise<LabWorklistItem> {
		return this.db.asUser(userId, async (tx) => {
			const item = await this.labItem(tx, userId, itemId);
			const mutation = (
				{
					collect: 'markSpecimenCollected',
					start: 'startDiagnosticOrderItem',
					release: 'releaseDiagnosticResult',
				} as const
			)[step];
			const card = await this.wiseProposals.verifyAction(
				userId,
				wiseOrigin,
				mutation,
				item.order.encounter.clinic.organizationId,
			);
			const target = { collect: 'SPECIMEN_COLLECTED', start: 'IN_PROGRESS', release: 'RELEASED' }[step];
			if (!(STEP_FROM[step] as readonly DiagnosticOrderStatus[]).includes(item.status)) {
				throw new InvalidStatusTransitionError('DiagnosticOrderItem', item.status, target);
			}
			const { event, action, after } = await apply(tx, item);
			await this.audit.record(tx, {
				action: action ?? 'UPDATE',
				event,
				entityType: 'DiagnosticOrderItem',
				entityId: item.id,
				userId,
				...this.scope(item),
				changes: { before: { status: item.status }, after },
				origin: card?.origin,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'DiagnosticOrderItem',
				entityId: item.id,
			});
			return toLabWorklistItem((await this.orders.findItem(tx, item.id))!);
		});
	}

	/** The test, visible to the user, at a clinic where they work the lab desk. */
	private async labItem(tx: ClinicalTx, userId: string, itemId: string): Promise<ItemRow> {
		const item = await this.orders.findItem(tx, itemId);
		if (!item) {
			throw new EntityNotFoundError('DiagnosticOrderItem', itemId);
		}
		await this.labDesk.assert(userId, item.order.encounter.clinicId);
		return item;
	}

	private scope(item: ItemRow) {
		const { clinic, patientId } = item.order.encounter;
		return { patientId, clinicId: clinic.id, organizationId: clinic.organizationId };
	}

	/** One VIEW row per patient of a list (RA 10173: who saw whose record). */
	private async auditListed(
		tx: ClinicalTx,
		userId: string,
		rows: readonly ItemRow[],
		event: string,
		reason?: string,
	): Promise<void> {
		const patients = new Map(rows.map((row) => [row.order.encounter.patientId, row.order.encounter.clinic]));
		await this.audit.recordMany(
			tx,
			[...patients].map(([patientId, clinic]) => ({
				action: 'VIEW' as const,
				event,
				entityType: 'Patient',
				entityId: patientId,
				userId,
				patientId,
				clinicId: clinic.id,
				organizationId: clinic.organizationId,
				reason: reason ?? null,
			})),
		);
	}
}

/** STAT first, then urgent, then routine; the oldest order first within each. */
function sortForDesk(rows: ItemRow[]): ItemRow[] {
	return [...rows].sort(
		(a, b) =>
			PRIORITY_RANK[a.order.priority] - PRIORITY_RANK[b.order.priority] ||
			a.order.createdAt.getTime() - b.order.createdAt.getTime(),
	);
}
