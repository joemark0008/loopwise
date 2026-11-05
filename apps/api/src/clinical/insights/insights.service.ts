import { chartFacilityPanel, chartPatientTrend, createReport } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { ChatRepository } from '../../chats/chat.repository.js';
import { ClinicalAccessDeniedError, EntityNotFoundError } from '../../common/errors/domain-error.js';
import { AuditService } from '../audit/audit.service.js';
import { CareClinicService } from '../patients/care-clinic.service.js';
import type { ClinicRef } from '../patients/models/clinic-ref.model.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import { buildEncounterSummarySections } from './encounter-summary.js';
import { PanelClinicRequiredError, ReportSubjectMissingError, UngroundedNarrativeError } from './insights.errors.js';
import { InsightsRepository } from './insights.repository.js';
import type { ReportPdf } from './models/report-pdf.model.js';
import { buildPanelChart, FLAG_ORDER, type PanelData } from './panel-chart.js';
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
	/** For facility_panel: one of the user's clinics (the tool's `facilityId`). */
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
 * Wise charts and summary reports (DESIGN.md §7.2). Everything is read as the user, so row-level security decides
 * what a chart or report can show, and every read is audited through `AuditService` (RA 10173): a chart as
 * `patient.view`, a clinic panel as `panel.view`, a report as `report.generate`, its PDF as `report.export`. Wise only
 * chooses the dataset; the numbers come from here.
 */
@Injectable()
export class InsightsService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly insights: InsightsRepository,
		private readonly chats: ChatRepository,
		private readonly clinics: CareClinicService,
		private readonly audit: AuditService,
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
			const vitals = code ? [] : await this.insights.vitals(tx, patientId, since);
			const results = code ? await this.insights.labValues(tx, patientId, { codes: [code], since }) : [];
			await this.audit.view(tx, {
				event: 'patient.view',
				entityType: 'Patient',
				entityId: patientId,
				userId,
				patientId,
				organizationId: patient.organizationId,
				reason: `Wise chart ${measure}`,
			});
			return {
				_version: '1' as const,
				measure,
				patient: { id: patient.id, name: `${patient.firstName} ${patient.lastName}` },
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

	/** Counts across one of the user's clinics, from the patients they may see; audited as `panel.view`. */
	async facilityPanel(
		userId: string,
		metric: chartFacilityPanel.PanelMetric,
		clinicId?: string,
		months = DEFAULT_PANEL_MONTHS,
		today = new Date(),
	): Promise<chartFacilityPanel.Output> {
		const clinic = await this.resolveClinic(userId, clinicId);
		const since = monthsAgo(today, months);
		return this.db.asUser(userId, async (tx) => {
			const data = await this.panelData(tx, clinic.id, since, [metric]);
			await this.audit.view(tx, {
				event: 'panel.view',
				entityType: 'Clinic',
				entityId: clinic.id,
				userId,
				organizationId: clinic.organizationId,
				clinicId: clinic.id,
				reason: `Wise chart ${metric}`,
			});
			return {
				_version: '1' as const,
				metric,
				facility: { id: clinic.id, name: clinic.name },
				months,
				asOf: today.toISOString(),
				chart: buildPanelChart(metric, data, since, today),
			};
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
			throw new EntityNotFoundError('Report', toolCallId);
		}
		const output = parsed.data;
		const { snapshot } = output;
		await this.db.asUser(userId, async (tx) => {
			const patient = snapshot.patientId ? await this.insights.patientHeader(tx, snapshot.patientId) : null;
			if (snapshot.patientId && !patient) {
				throw new EntityNotFoundError('Report', toolCallId);
			}
			await this.audit.record(tx, {
				action: 'EXPORT',
				event: 'report.export',
				entityType: 'Report',
				entityId: toolCallId,
				userId,
				patientId: snapshot.patientId,
				organizationId: patient?.organizationId ?? null,
				clinicId: snapshot.facility?.id ?? null,
				reason: 'PDF download',
			});
		});
		const pdf = await renderReportPdf(output);
		return { filename: reportFilename(snapshot), mimeType: 'application/pdf', data: pdf.toString('base64') };
	}

	private patientSummary(userId: string, spec: ReportSpec, today: Date): Promise<createReport.Snapshot> {
		const { patientId } = spec;
		if (!patientId) {
			throw new ReportSubjectMissingError('A patient summary needs the patient: use find_patient first.');
		}
		const months = spec.months ?? DEFAULT_MONTHS;
		return this.db.asUser(userId, async (tx) => {
			const patient = await this.insights.patientHeader(tx, patientId);
			if (!patient) {
				throw new EntityNotFoundError('Patient', patientId);
			}
			const since = monthsAgo(today, months);
			// One after the other: a transaction's queries share one connection.
			const diagnoses = await this.insights.diagnoses(tx, patientId);
			const medicinesSince = new Date(today.getTime() - MEDICINES_DAYS * DAY);
			const prescriptions = await this.insights.issuedPrescriptions(tx, patientId, medicinesSince);
			const latestVitals = await this.insights.latestVitals(tx, patientId, 10);
			const recentResults = await this.insights.labValues(tx, patientId, { take: 12 });
			const encounters = await this.insights.encounters(tx, patientId, 10);
			const trendVitals = await this.insights.vitals(tx, patientId, since);
			const trendResults = await this.insights.labValues(tx, patientId, {
				codes: Object.values(LAB_CODES),
				since,
			});
			const charts =
				spec.charts && spec.charts.length > 0
					? [...new Set(spec.charts)]
					: (['blood_pressure', 'hba1c'] as const).filter(
							(measure) =>
								measure === 'blood_pressure' ||
								trendResults.some((result) => result.code === LAB_CODES[measure]),
						);
			const snapshot: createReport.Snapshot = {
				type: spec.type,
				title: createReport.REPORT_TYPE_LABELS[spec.type],
				subject: patientSubject(patient, today),
				patientId,
				facility: null,
				generatedAt: today.toISOString(),
				generatedBy: await this.insights.userName(tx, userId),
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
			await this.audit.view(tx, {
				event: 'report.generate',
				entityType: 'Report',
				entityId: spec.reportId,
				userId,
				patientId,
				organizationId: patient.organizationId,
				reason: `Wise ${spec.type}`,
			});
			return snapshot;
		});
	}

	private encounterSummary(userId: string, spec: ReportSpec, today: Date): Promise<createReport.Snapshot> {
		const { encounterId } = spec;
		if (!encounterId) {
			throw new ReportSubjectMissingError('An encounter summary needs an [encounter <id>] from the record.');
		}
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.insights.encounterRecord(tx, encounterId);
			if (!encounter || (spec.patientId && encounter.patientId !== spec.patientId)) {
				throw new EntityNotFoundError('Encounter', encounterId);
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
			await this.audit.view(tx, {
				event: 'report.generate',
				entityType: 'Report',
				entityId: spec.reportId,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.clinic.organizationId,
				clinicId: encounter.clinicId,
				reason: `Wise ${spec.type} of encounter ${encounter.encounterNo}`,
			});
			return snapshot;
		});
	}

	private async facilityPanelReport(userId: string, spec: ReportSpec, today: Date): Promise<createReport.Snapshot> {
		const clinic = await this.resolveClinic(userId, spec.facilityId);
		const months = spec.months ?? DEFAULT_PANEL_MONTHS;
		const since = monthsAgo(today, months);
		return this.db.asUser(userId, async (tx) => {
			const data = await this.panelData(tx, clinic.id, since, chartFacilityPanel.PANEL_METRICS);
			const patientsSeen = new Set(data.encounters.map((encounter) => encounter.patientId)).size;
			const snapshot: createReport.Snapshot = {
				type: spec.type,
				title: createReport.REPORT_TYPE_LABELS[spec.type],
				subject: clinic.name,
				patientId: null,
				facility: { id: clinic.id, name: clinic.name },
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
							{ label: 'Scope', value: 'Patients in your care at this clinic' },
						],
					},
					...chartFacilityPanel.PANEL_METRICS.map((metric): createReport.Section => {
						const chart = buildPanelChart(metric, data, since, today);
						return { kind: 'chart', title: chart.title, chart };
					}),
				],
			};
			assertGrounded(spec.narrative, snapshot);
			await this.audit.view(tx, {
				event: 'report.generate',
				entityType: 'Report',
				entityId: spec.reportId,
				userId,
				organizationId: clinic.organizationId,
				clinicId: clinic.id,
				reason: `Wise ${spec.type}`,
			});
			return snapshot;
		});
	}

	/** The clinic the panel is about: the one given (if the user works there), else their only one. */
	private async resolveClinic(userId: string, clinicId?: string): Promise<ClinicRef> {
		const clinics = await this.clinics.list(userId);
		if (clinicId) {
			const clinic = clinics.find((candidate) => candidate.id === clinicId);
			if (!clinic) {
				throw new ClinicalAccessDeniedError('You can only see the panel of a clinic you work at.');
			}
			return clinic;
		}
		if (clinics.length === 1) {
			return clinics[0];
		}
		if (clinics.length === 0) {
			throw new ClinicalAccessDeniedError('You do not work at a clinic.');
		}
		throw new PanelClinicRequiredError(
			`You work at several clinics; pass facilityId, one of: ${clinics.map(({ id, name }) => `${name} (${id})`).join(', ')}.`,
		);
	}

	private async panelData(
		tx: ClinicalTx,
		clinicId: string,
		since: Date,
		metrics: readonly chartFacilityPanel.PanelMetric[],
	): Promise<Omit<PanelData, 'encounters'> & { encounters: { startedAt: Date; patientId: string }[] }> {
		const wants = (metric: chartFacilityPanel.PanelMetric) => metrics.includes(metric);
		const encounters = wants('encounters_by_week') ? await this.insights.clinicEncounters(tx, clinicId, since) : [];
		const diagnoses = wants('diagnoses_by_icd10_chapter')
			? await this.insights.clinicDiagnoses(tx, clinicId, since)
			: [];
		const openOrders = wants('open_orders_by_age') ? await this.insights.openOrders(tx, clinicId) : [];
		const awaiting = wants('results_awaiting_review')
			? await this.insights.resultsAwaitingReview(tx, clinicId)
			: [];
		return {
			encounters,
			diagnoses,
			openOrders,
			awaitingReview: awaiting.map((result) => ({ flag: worstFlag(result.values.map((value) => value.flag)) })),
		};
	}
}

/** Refuses a narrative with numbers the report's data doesn't hold, so Wise rewrites it. */
function assertGrounded(narrative: string, snapshot: createReport.Snapshot): void {
	const ungrounded = createReport.ungroundedNumbers(narrative, snapshot);
	if (ungrounded.length > 0) {
		throw new UngroundedNarrativeError(ungrounded);
	}
}

/** The worst `ResultFlag` of a result's values (critical first), null when none is flagged. */
export function worstFlag(flags: readonly (string | null)[]): string | null {
	const present = flags.filter((flag): flag is string => flag !== null);
	if (present.length === 0) {
		return null;
	}
	return [...present].sort((a, b) => FLAG_ORDER.indexOf(a) - FLAG_ORDER.indexOf(b))[0];
}

/** `patient-summary-santos-2026-11-03.pdf`: the type, the subject's family name (or clinic) and the day. */
export function reportFilename(snapshot: createReport.Snapshot): string {
	const subject = snapshot.patientId
		? (snapshot.subject.split(' · ')[0].split(' ').at(-1) ?? 'patient')
		: (snapshot.facility?.name ?? 'clinic');
	const slug = (value: string) =>
		value
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	return `${slug(snapshot.type)}-${slug(subject)}-${snapshot.generatedAt.slice(0, 10)}.pdf`;
}
