import { chartFacilityPanel, chartPatientTrend, createReport } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { ChatRepository } from '../../chats/chat.repository.js';
import { HandlerError } from '../../common/errors/handler-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { buildEncounterSummarySections } from './encounter-summary.js';
import { InsightsRepository } from './insights.repository.js';
import type { ReportPdf } from './models/report-pdf.model.js';
import { buildPanelChart, type PanelData } from './panel-chart.js';
import { buildPatientSummarySections, patientSubject } from './patient-summary.js';
import { renderReportPdf } from './report-pdf/report-pdf.js';
import { buildTrendChart, LAB_CODES } from './trend-chart.js';

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_MONTHS = 12;
const DEFAULT_PANEL_MONTHS = 6;
const MEDICINES_DAYS = 180;

export interface ReportSpec {
	type: createReport.ReportType;
	patientId?: string;
	encounterId?: string;
	facilityId?: string;
	months?: number;
	charts?: chartPatientTrend.PatientMeasure[];
	/** Wise's narrative: refused (and nothing audited) when it has a number the data sections lack. */
	narrative: string;
	/** The tool call that builds it: the report's id in the audit log. */
	reportId: string;
}

const monthsAgo = (today: Date, months: number) => {
	const since = new Date(today);
	since.setUTCMonth(since.getUTCMonth() - months);
	return since;
};

/**
 * Wise charts and summary reports (DESIGN.md §9.2). Everything is read as the user, so row-level security decides
 * what a chart or report can show, and every read is audited: a chart as a `patient.view`, a report as
 * `report.generate`. Wise only chooses the dataset; the numbers come from here.
 */
@Injectable()
export class InsightsService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly insights: InsightsRepository,
		private readonly chats: ChatRepository,
		private readonly organizations: OrganizationRepository,
	) {}

	/** One measure of a patient over `months`; null when the user may not see the patient. */
	patientTrend(
		userId: string,
		patientId: string,
		measure: chartPatientTrend.PatientMeasure,
		months = DEFAULT_MONTHS,
		today = new Date(),
	): Promise<chartPatientTrend.Output | null> {
		return this.db.asUser(userId, async (tx) => {
			const patient = await this.insights.patientHeader(tx, patientId);
			if (!patient) {
				return null;
			}
			const since = monthsAgo(today, months);
			const code = LAB_CODES[measure];
			const [vitals, results] = await Promise.all([
				code ? [] : this.insights.vitals(tx, patientId, since),
				code ? this.insights.results(tx, patientId, { codes: [code], since }) : [],
			]);
			await this.insights.writeAudit(tx, {
				userId,
				patientId,
				action: 'patient.view',
				resource: 'patient',
				resourceId: patientId,
				reason: `Wise chart ${measure}`,
			});
			return {
				_version: '1' as const,
				measure,
				patient: { id: patient.id, name: `${patient.givenName} ${patient.familyName}` },
				months,
				asOf: today.toISOString(),
				chart: buildTrendChart(measure, vitals, results),
			};
		});
	}

	/** The frozen data of a report, built as the user and audited as `report.generate`. */
	buildReport(userId: string, spec: ReportSpec, today = new Date()): Promise<createReport.Snapshot> {
		switch (spec.type) {
			case 'patient_summary':
				return this.patientSummary(userId, spec, today);
			case 'encounter_summary':
				return this.encounterSummary(userId, spec, today);
			case 'facility_panel':
				return this.facilityPanelReport(userId, spec, today);
		}
	}

	/** Counts across one of the user's facilities, from the patients they may see; audited as `panel.view`. */
	async facilityPanel(
		userId: string,
		metric: chartFacilityPanel.PanelMetric,
		facilityId?: string,
		months = DEFAULT_PANEL_MONTHS,
		today = new Date(),
	): Promise<chartFacilityPanel.Output> {
		const facility = await this.resolveFacility(userId, facilityId);
		const since = monthsAgo(today, months);
		return this.db.asUser(userId, async (tx) => {
			const data = await this.panelData(tx, facility.id, since, [metric]);
			await this.insights.writeAudit(tx, {
				userId,
				orgId: facility.id,
				action: 'panel.view',
				resource: 'organization',
				resourceId: facility.id,
				reason: `Wise chart ${metric}`,
			});
			return {
				_version: '1' as const,
				metric,
				facility,
				months,
				asOf: today.toISOString(),
				chart: buildPanelChart(metric, data, since, today),
			};
		});
	}

	private encounterSummary(userId: string, spec: ReportSpec, today: Date): Promise<createReport.Snapshot> {
		const { encounterId } = spec;
		if (!encounterId) {
			throw new HandlerError('BAD_REQUEST', 'An encounter summary needs an [encounter <id>] from the record.');
		}
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.insights.encounterRecord(tx, encounterId);
			if (!encounter || (spec.patientId && encounter.patientId !== spec.patientId)) {
				throw new HandlerError('NOT_FOUND', 'Encounter not found. Use only [encounter <id>]s from the record.');
			}
			const snapshot: createReport.Snapshot = {
				type: spec.type,
				title: createReport.REPORT_TYPE_LABELS[spec.type],
				subject: `${patientSubject(encounter.patient, today)} · visit ${encounter.startedAt.toISOString().slice(0, 10)}`,
				patientId: encounter.patientId,
				facility: null,
				generatedAt: today.toISOString(),
				generatedBy: await this.insights.userName(tx, userId),
				months: spec.months ?? DEFAULT_MONTHS,
				sections: buildEncounterSummarySections(encounter, today),
			};
			assertGrounded(spec.narrative, snapshot);
			await this.insights.writeAudit(tx, {
				userId,
				orgId: encounter.orgId,
				patientId: encounter.patientId,
				action: 'report.generate',
				resource: 'report',
				resourceId: spec.reportId,
				reason: `Wise ${spec.type} of encounter ${encounterId}`,
			});
			return snapshot;
		});
	}

	private async facilityPanelReport(userId: string, spec: ReportSpec, today: Date): Promise<createReport.Snapshot> {
		const facility = await this.resolveFacility(userId, spec.facilityId);
		const months = spec.months ?? DEFAULT_PANEL_MONTHS;
		const since = monthsAgo(today, months);
		return this.db.asUser(userId, async (tx) => {
			const data = await this.panelData(tx, facility.id, since, chartFacilityPanel.PANEL_METRICS);
			const patientsSeen = new Set(data.encounters.map((encounter) => encounter.patientId)).size;
			const snapshot: createReport.Snapshot = {
				type: spec.type,
				title: createReport.REPORT_TYPE_LABELS[spec.type],
				subject: facility.name,
				patientId: null,
				facility,
				generatedAt: today.toISOString(),
				generatedBy: await this.insights.userName(tx, userId),
				months,
				sections: [
					{
						kind: 'facts',
						title: 'At a glance',
						facts: [
							{ label: 'Encounters', value: String(data.encounters.length) },
							{ label: 'Patients seen', value: String(patientsSeen) },
							{ label: 'Diagnoses recorded', value: String(data.diagnoses.length) },
							{ label: 'Open orders', value: String(data.openOrders.length) },
							{ label: 'Results to review', value: String(data.awaitingReview.length) },
							{ label: 'Scope', value: 'Patients in your care at this facility' },
						],
					},
					...chartFacilityPanel.PANEL_METRICS.map((metric): createReport.Section => {
						const chart = buildPanelChart(metric, data, since, today);
						return { kind: 'chart', title: chart.title, chart };
					}),
				],
			};
			assertGrounded(spec.narrative, snapshot);
			await this.insights.writeAudit(tx, {
				userId,
				orgId: facility.id,
				action: 'report.generate',
				resource: 'report',
				resourceId: spec.reportId,
				reason: `Wise ${spec.type}`,
			});
			return snapshot;
		});
	}

	/** The facility the panel is about: the one given (if the user works there), else their only one. */
	private async resolveFacility(userId: string, facilityId?: string): Promise<{ id: string; name: string }> {
		const facilities = (await this.organizations.getUserFacilities(userId)).map(({ id, name }) => ({ id, name }));
		if (facilityId) {
			const facility = facilities.find((candidate) => candidate.id === facilityId);
			if (!facility) {
				throw new HandlerError('FORBIDDEN', 'You can only see the panel of a facility you work at.');
			}
			return facility;
		}
		if (facilities.length === 1) {
			return facilities[0];
		}
		if (facilities.length === 0) {
			throw new HandlerError('FORBIDDEN', 'You do not work at a facility.');
		}
		throw new HandlerError(
			'BAD_REQUEST',
			`You work at several facilities; pass facilityId, one of: ${facilities.map(({ id, name }) => `${name} (${id})`).join(', ')}.`,
		);
	}

	private async panelData(
		tx: Prisma.TransactionClient,
		orgId: string,
		since: Date,
		metrics: readonly chartFacilityPanel.PanelMetric[],
	): Promise<Omit<PanelData, 'encounters'> & { encounters: { startedAt: Date; patientId: string }[] }> {
		const wants = (metric: chartFacilityPanel.PanelMetric) => metrics.includes(metric);
		return {
			encounters: wants('encounters_by_week') ? await this.insights.facilityEncounters(tx, orgId, since) : [],
			diagnoses: wants('diagnoses_by_icd10_chapter')
				? await this.insights.facilityDiagnoses(tx, orgId, since)
				: [],
			openOrders: wants('open_orders_by_age') ? await this.insights.openOrders(tx, orgId) : [],
			awaitingReview: wants('results_awaiting_review')
				? await this.insights.resultsAwaitingReview(tx, orgId)
				: [],
		};
	}

	private patientSummary(userId: string, spec: ReportSpec, today: Date): Promise<createReport.Snapshot> {
		const { patientId } = spec;
		if (!patientId) {
			throw new HandlerError('BAD_REQUEST', 'A patient summary needs the patient: use find_patient first.');
		}
		const months = spec.months ?? DEFAULT_MONTHS;
		return this.db.asUser(userId, async (tx) => {
			const patient = await this.insights.patientHeader(tx, patientId);
			if (!patient) {
				throw new HandlerError('NOT_FOUND', 'Patient not found. Use find_patient and only ids it returned.');
			}
			const since = monthsAgo(today, months);
			const [diagnoses, prescriptions, latestVitals, recentResults, encounters, trendVitals, trendResults] =
				await Promise.all([
					this.insights.diagnoses(tx, patientId),
					this.insights.issuedPrescriptions(tx, patientId, new Date(today.getTime() - MEDICINES_DAYS * DAY)),
					this.insights.latestVitals(tx, patientId, 10),
					this.insights.results(tx, patientId, { take: 12 }),
					this.insights.encounters(tx, patientId, 10),
					this.insights.vitals(tx, patientId, since),
					this.insights.results(tx, patientId, { codes: Object.values(LAB_CODES), since }),
				]);
			const charts =
				spec.charts && spec.charts.length > 0
					? [...new Set(spec.charts)]
					: (['blood_pressure', 'hba1c'] as const).filter(
							(measure) =>
								measure === 'blood_pressure' ||
								trendResults.some((result) => result.code === LAB_CODES[measure]),
						);
			const generatedBy = await this.insights.userName(tx, userId);
			const snapshot: createReport.Snapshot = {
				type: spec.type,
				title: createReport.REPORT_TYPE_LABELS[spec.type],
				subject: patientSubject(patient, today),
				patientId,
				facility: null,
				generatedAt: today.toISOString(),
				generatedBy,
				months,
				sections: buildPatientSummarySections(
					{
						patient,
						diagnoses,
						prescriptions,
						latestVitals,
						recentResults,
						encounters,
						trendVitals,
						trendResults,
						charts,
					},
					today,
				),
			};
			assertGrounded(spec.narrative, snapshot);
			await this.insights.writeAudit(tx, {
				userId,
				patientId,
				action: 'report.generate',
				resource: 'report',
				resourceId: spec.reportId,
				reason: `Wise ${spec.type}`,
			});
			return snapshot;
		});
	}

	/**
	 * Prints a report Wise built in the user's own chat, from its frozen data. Only the chat's owner can, and only
	 * while they still see the patient; the download is audited as `report.export` (PHI leaving the system).
	 */
	async exportReportPdf(userId: string, chatId: string, toolCallId: string): Promise<ReportPdf> {
		const parsed = createReport.OutputSchema.safeParse(
			await this.chats.getOwnToolOutput(userId, chatId, toolCallId, 'create_report'),
		);
		if (!parsed.success) {
			throw new HandlerError('NOT_FOUND', 'Report not found.');
		}
		const output = parsed.data;
		const { snapshot } = output;
		await this.db.asUser(userId, async (tx) => {
			if (snapshot.patientId && !(await this.insights.patientHeader(tx, snapshot.patientId))) {
				throw new HandlerError('NOT_FOUND', 'Report not found.');
			}
			await this.insights.writeAudit(tx, {
				userId,
				orgId: snapshot.facility?.id,
				patientId: snapshot.patientId,
				action: 'report.export',
				resource: 'report',
				resourceId: toolCallId,
				reason: 'PDF download',
			});
		});
		const pdf = await renderReportPdf(output);
		return { filename: reportFilename(snapshot), mimeType: 'application/pdf', data: pdf.toString('base64') };
	}
}

/** Refuses a narrative with numbers the report's data doesn't hold, so Wise rewrites it. */
function assertGrounded(narrative: string, snapshot: createReport.Snapshot): void {
	const ungrounded = createReport.ungroundedNumbers(narrative, snapshot);
	if (ungrounded.length > 0) {
		throw new HandlerError(
			'BAD_REQUEST',
			`The narrative has numbers the report's data doesn't contain (${ungrounded.join(', ')}). Rewrite it without them and call create_report again.`,
		);
	}
}

/** `patient-summary-santos-2026-11-03.pdf`: the type, the subject's family name (or facility) and the day. */
export function reportFilename(snapshot: createReport.Snapshot): string {
	const subject = snapshot.patientId
		? (snapshot.subject.split(' · ')[0].split(' ').at(-1) ?? 'patient')
		: (snapshot.facility?.name ?? 'facility');
	const slug = (value: string) =>
		value
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	return `${slug(snapshot.type)}-${slug(subject)}-${snapshot.generatedAt.slice(0, 10)}.pdf`;
}
