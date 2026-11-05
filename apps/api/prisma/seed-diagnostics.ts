// The diagnostics demo (synthetic data only): the organization's test catalog (HbA1c, FBS, lipid profile, CBC,
// urinalysis, chest X-ray PA) and orders that reproduce the demo's story: Maria Santos's year of HbA1c 6.1 → 7.2 % and
// FBS 112 → 131 mg/dL (released; the latest FBS awaits Dr. Reyes's review), Pedro's critical HbA1c and Carmen's
// borderline one in the results inbox, earlier HbA1c for Pedro and Ramon (walk-in lab requests from outside doctors),
// and tests at each step of the lab worklist (requested, collected, in progress) so the lab desk has work.
import { DocumentSequenceRepository } from '../src/clinical/clinics/document-sequences/document-sequence.repository.js';
import { DocumentSequenceService } from '../src/clinical/clinics/document-sequences/document-sequence.service.js';
import type { DiagnosticTestParameterRow } from '../src/clinical/diagnostics/catalog/models/diagnostic-test.model.js';
import { deriveOrderStatus } from '../src/clinical/diagnostics/orders/diagnostic-order-status.js';
import { buildResultValues, type ResultValueEntry } from '../src/clinical/diagnostics/worklist/result-values.js';
import type {
	DiagnosticCategory,
	DiagnosticOrderStatus,
	OrderPriority,
	Prisma,
	ResultValueType,
} from '../src/generated/prisma/client.js';
import {
	DEMO_CLINIC_CODE,
	DEMO_ORG_SLUG,
	DEMO_PATIENTS,
	DEMO_STAFF,
	demoEncounterOf,
	type DemoPatientKey,
} from './seed-clinical.js';

type Tx = Prisma.TransactionClient;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface ParameterSpec {
	code: string;
	name: string;
	unit?: string;
	valueType?: ResultValueType;
	options?: string[];
	/** [low male, high male, low female, high female]; null for an open end. */
	range?: [number | null, number | null, number | null, number | null];
	refRangeText?: string;
	loinc?: string;
}

interface TestSpec {
	code: string;
	name: string;
	category: DiagnosticCategory;
	section: string;
	specimenType?: string;
	requiresFasting?: boolean;
	turnaroundHours: number;
	loinc: string | null;
	parameters: ParameterSpec[];
}

const both = (
	low: number | null,
	high: number | null,
): [number | null, number | null, number | null, number | null] => [low, high, low, high];

const URINE_OPTIONS = ['Negative', 'Trace', '1+', '2+', '3+', '4+'];

/** The catalog (codes and LOINC as `@loopwise/shared/lab-tests`). Reference ranges are typical adult values. */
const CATALOG: TestSpec[] = [
	{
		code: 'HBA1C',
		name: 'Hemoglobin A1c (HbA1c)',
		category: 'LABORATORY',
		section: 'Clinical Chemistry',
		specimenType: 'Whole blood (EDTA)',
		turnaroundHours: 24,
		loinc: '4548-4',
		parameters: [{ code: 'HBA1C', name: 'HbA1c', unit: '%', range: both(4.0, 5.6), loinc: '4548-4' }],
	},
	{
		code: 'FBS',
		name: 'Fasting blood sugar (FBS)',
		category: 'LABORATORY',
		section: 'Clinical Chemistry',
		specimenType: 'Serum',
		requiresFasting: true,
		turnaroundHours: 4,
		loinc: '1558-6',
		parameters: [{ code: 'FBS', name: 'Fasting blood sugar', unit: 'mg/dL', range: both(70, 99), loinc: '1558-6' }],
	},
	{
		code: 'LIPID',
		name: 'Lipid profile',
		category: 'LABORATORY',
		section: 'Clinical Chemistry',
		specimenType: 'Serum',
		requiresFasting: true,
		turnaroundHours: 24,
		loinc: '57698-3',
		parameters: [
			{ code: 'CHOL', name: 'Total cholesterol', unit: 'mg/dL', range: both(null, 200), loinc: '2093-3' },
			{ code: 'TRIG', name: 'Triglycerides', unit: 'mg/dL', range: both(null, 150), loinc: '2571-8' },
			{ code: 'HDL', name: 'HDL cholesterol', unit: 'mg/dL', range: [40, null, 50, null], loinc: '2085-9' },
			{
				code: 'LDL',
				name: 'LDL cholesterol (calculated)',
				unit: 'mg/dL',
				range: both(null, 100),
				loinc: '13457-7',
			},
		],
	},
	{
		code: 'CBC',
		name: 'Complete blood count (CBC)',
		category: 'LABORATORY',
		section: 'Hematology',
		specimenType: 'Whole blood (EDTA)',
		turnaroundHours: 4,
		loinc: '58410-2',
		parameters: [
			{ code: 'HGB', name: 'Hemoglobin', unit: 'g/dL', range: [13.5, 17.5, 12.0, 15.5], loinc: '718-7' },
			{ code: 'HCT', name: 'Hematocrit', unit: '%', range: [41, 53, 36, 46], loinc: '4544-3' },
			{ code: 'WBC', name: 'White blood cells', unit: '×10⁹/L', range: both(4.5, 11.0), loinc: '6690-2' },
			{ code: 'PLT', name: 'Platelets', unit: '×10⁹/L', range: both(150, 450), loinc: '777-3' },
		],
	},
	{
		code: 'UA',
		name: 'Urinalysis',
		category: 'LABORATORY',
		section: 'Clinical Microscopy',
		specimenType: 'Urine (midstream)',
		turnaroundHours: 2,
		loinc: '24356-8',
		parameters: [
			{ code: 'COLOR', name: 'Color', valueType: 'TEXT', refRangeText: 'Yellow' },
			{ code: 'PH', name: 'pH', range: both(4.5, 8.0), loinc: '2756-5' },
			{ code: 'SG', name: 'Specific gravity', range: both(1.005, 1.03), loinc: '2965-2' },
			{
				code: 'PROT',
				name: 'Protein',
				valueType: 'OPTION',
				options: URINE_OPTIONS,
				refRangeText: 'Negative',
				loinc: '2888-6',
			},
			{
				code: 'GLU',
				name: 'Glucose',
				valueType: 'OPTION',
				options: URINE_OPTIONS,
				refRangeText: 'Negative',
				loinc: '2350-7',
			},
			{ code: 'RBC', name: 'RBC', unit: '/hpf', range: both(0, 2) },
			{ code: 'WBC', name: 'Pus cells (WBC)', unit: '/hpf', range: both(0, 5) },
		],
	},
	{
		code: 'CXR-PA',
		name: 'Chest X-ray PA',
		category: 'IMAGING',
		section: 'X-Ray',
		turnaroundHours: 24,
		loinc: null,
		parameters: [],
	},
];

type TestCode = 'HBA1C' | 'FBS' | 'LIPID' | 'CBC' | 'UA' | 'CXR-PA';

/** One test of a demo order: its step, and its result (value entries by parameter code) once there is one. */
interface ItemSpec {
	test: TestCode;
	status: DiagnosticOrderStatus;
	values?: Record<string, string | { value: string; critical: true }>;
	findings?: string;
	impression?: string;
	/** Hours after the order; the result is released an hour later. */
	resultedAfterHours?: number;
	reviewed?: boolean;
}

/**
 * Seeds the catalog and the demo orders, once (skipped when the organization already has a catalog). Runs as system
 * work on the seed's transaction; finds the demo organization, clinic, staff, patients and visits through the
 * constants of `seed-clinical.ts`.
 */
export async function seedDiagnostics(tx: Tx): Promise<void> {
	const organization = await tx.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } });
	if (!organization || (await tx.diagnosticTest.count({ where: { organizationId: organization.id } })) > 0) {
		return;
	}
	const clinic = await tx.clinic.findUniqueOrThrow({
		where: { organizationId_code: { organizationId: organization.id, code: DEMO_CLINIC_CODE } },
	});
	const userId = async (email: string) => (await tx.user.findUniqueOrThrow({ where: { email } })).id;
	const reyesUserId = await userId(DEMO_STAFF.doctor);
	const medtechId = await userId(DEMO_STAFF.medtech);
	const reyes = await tx.practitioner.findUniqueOrThrow({ where: { userId: reyesUserId } });
	const sequences = new DocumentSequenceService(new DocumentSequenceRepository());

	const tests = new Map<string, { id: string; parameters: DiagnosticTestParameterRow[] }>();
	for (const spec of CATALOG) {
		const test = await tx.diagnosticTest.create({
			data: {
				organizationId: organization.id,
				code: spec.code,
				name: spec.name,
				category: spec.category,
				section: spec.section,
				specimenType: spec.specimenType ?? null,
				requiresFasting: spec.requiresFasting ?? false,
				turnaroundHours: spec.turnaroundHours,
				lisCode: spec.loinc,
				parameters: {
					create: spec.parameters.map((parameter, index) => ({
						code: parameter.code,
						name: parameter.name,
						unit: parameter.unit ?? null,
						valueType: parameter.valueType ?? 'NUMERIC',
						options: parameter.options ?? [],
						refLowMale: parameter.range?.[0] ?? null,
						refHighMale: parameter.range?.[1] ?? null,
						refLowFemale: parameter.range?.[2] ?? null,
						refHighFemale: parameter.range?.[3] ?? null,
						refRangeText: parameter.refRangeText ?? null,
						lisCode: parameter.loinc ?? null,
						sortOrder: index,
					})),
				},
			},
			include: { parameters: true },
		});
		tests.set(spec.code, test);
	}

	const patient = (key: DemoPatientKey) =>
		tx.patient.findUniqueOrThrow({
			where: {
				organizationId_patientNo: { organizationId: organization.id, patientNo: DEMO_PATIENTS[key].patientNo },
			},
		});
	const visit = async (key: DemoPatientKey, which: 'latest' | 'earliest' | number) => {
		if (typeof which !== 'number') {
			return (await demoEncounterOf(tx, key, which))!;
		}
		// The visit nearest `which` days ago.
		const visits = await tx.encounter.findMany({ where: { patientId: (await patient(key)).id } });
		const at = Date.now() - which * DAY;
		return visits.sort((a, b) => Math.abs(a.startedAt.getTime() - at) - Math.abs(b.startedAt.getTime() - at))[0];
	};

	/** A walk-in lab visit for an outside doctor's request (an earlier HbA1c done before the patient came to TAG). */
	const labVisit = async (key: DemoPatientKey, startedAt: Date) => {
		const { id: patientId } = await patient(key);
		return tx.encounter.create({
			data: {
				encounterNo: await sequences.next(tx, clinic, 'ENCOUNTER', startedAt),
				clinicId: clinic.id,
				patientId,
				type: 'CONSULTATION',
				status: 'COMPLETED',
				startedAt,
				endedAt: new Date(startedAt.getTime() + HOUR),
				chiefComplaint: "Laboratory only (outside doctor's request)",
				createdById: medtechId,
			},
		});
	};

	const order = async (
		encounter: { id: string; patientId: string; startedAt: Date },
		opts: {
			items: ItemSpec[];
			priority?: OrderPriority;
			clinicalInfo?: string;
			externalPhysician?: string;
			afterHours?: number;
		},
	) => {
		const { sex } = await tx.patient.findUniqueOrThrow({ where: { id: encounter.patientId } });
		const orderedAt = new Date(encounter.startedAt.getTime() + (opts.afterHours ?? 1) * HOUR);
		const created = await tx.diagnosticOrder.create({
			data: {
				orderNo: await sequences.next(tx, clinic, 'LAB_ORDER', orderedAt),
				encounterId: encounter.id,
				requestedById: opts.externalPhysician ? null : reyes.id,
				externalPhysician: opts.externalPhysician ?? null,
				priority: opts.priority ?? 'ROUTINE',
				status: deriveOrderStatus(opts.items.map((item) => item.status)),
				clinicalInfo: opts.clinicalInfo ?? null,
				createdAt: orderedAt,
			},
		});
		for (const spec of opts.items) {
			const test = tests.get(spec.test)!;
			const collected = spec.status !== 'REQUESTED' && spec.status !== 'PAID';
			const item = await tx.diagnosticOrderItem.create({
				data: {
					orderId: created.id,
					testId: test.id,
					status: spec.status,
					...(collected && {
						accessionNo: `${created.orderNo}-${spec.test}`,
						specimenCollectedAt: new Date(orderedAt.getTime() + HOUR / 2),
						collectedById: medtechId,
					}),
				},
			});
			if (!spec.values && !spec.findings) {
				continue;
			}
			const entries: ResultValueEntry[] = Object.entries(spec.values ?? {}).map(([code, entry]) => ({
				parameterId: test.parameters.find((parameter) => parameter.code === code)!.id,
				value: typeof entry === 'string' ? entry : entry.value,
				critical: typeof entry === 'string' ? false : entry.critical,
			}));
			const resultedAt = new Date(orderedAt.getTime() + (spec.resultedAfterHours ?? 6) * HOUR);
			const released = spec.status === 'RELEASED';
			await tx.diagnosticResult.create({
				data: {
					orderItemId: item.id,
					performedById: medtechId,
					findings: spec.findings ?? null,
					impression: spec.impression ?? null,
					resultedAt,
					...(released && { releasedAt: new Date(resultedAt.getTime() + HOUR), verifiedById: medtechId }),
					...(released &&
						spec.reviewed && {
							reviewedAt: new Date(resultedAt.getTime() + DAY / 2),
							reviewedById: reyesUserId,
						}),
					values: { create: buildResultValues(test.parameters, sex, entries) },
				},
			});
		}
	};

	// Maria Santos: HbA1c 6.1 % and FBS 112 mg/dL at her check-up six months before her first full visit; HbA1c 7.2 %
	// and a lipid profile at that visit; the repeat FBS of 131 mg/dL three days later, released and awaiting review.
	const mariaCheckup = await visit('maria', 12 + 180);
	await order(mariaCheckup, {
		clinicalInfo: 'Elevated fasting blood sugar on screening',
		items: [
			{ test: 'HBA1C', status: 'RELEASED', values: { HBA1C: '6.1' }, resultedAfterHours: 48, reviewed: true },
			{ test: 'FBS', status: 'RELEASED', values: { FBS: '112' }, resultedAfterHours: 48, reviewed: true },
		],
	});
	const mariaVisit = await visit('maria', 'latest');
	await order(mariaVisit, {
		clinicalInfo: 'Polyuria, fatigue; r/o type 2 diabetes mellitus',
		items: [
			{ test: 'HBA1C', status: 'RELEASED', values: { HBA1C: '7.2' }, resultedAfterHours: 48, reviewed: true },
			{
				test: 'LIPID',
				status: 'RELEASED',
				values: { CHOL: '228', TRIG: '182', HDL: '44', LDL: '148' },
				resultedAfterHours: 48,
				reviewed: true,
			},
		],
	});
	await order(mariaVisit, {
		clinicalInfo: 'Repeat FBS to confirm diabetes range',
		afterHours: 3 * 24,
		items: [{ test: 'FBS', status: 'RELEASED', values: { FBS: '131' }, resultedAfterHours: 4 }],
	});

	// Pedro Villanueva: HbA1c 9.4 % four months ago (outside doctor's request); 12.1 % now, called in as critical.
	const pedroVisit = await visit('pedro', 'latest');
	await order(await labVisit('pedro', new Date(pedroVisit.startedAt.getTime() - 120 * DAY)), {
		externalPhysician: 'Dr. Lorna Cabahug (private clinic)',
		items: [{ test: 'HBA1C', status: 'RELEASED', values: { HBA1C: '9.4' }, reviewed: true }],
	});
	await order(pedroVisit, {
		priority: 'STAT',
		clinicalInfo: 'Weight loss, polydipsia',
		items: [
			{ test: 'HBA1C', status: 'RELEASED', values: { HBA1C: { value: '12.1', critical: true } } },
			{ test: 'CXR-PA', status: 'REQUESTED' },
		],
	});

	// Ramon Gonzaga: HbA1c 7.9 % before his follow-up, 8.4 % at it (reviewed); a lipid profile running today.
	const ramonFollowUp = await visit('ramon', 40);
	await order(await labVisit('ramon', new Date(ramonFollowUp.startedAt.getTime() - 120 * DAY)), {
		externalPhysician: 'Dr. Ernesto Lim (Bohol Medical Clinic)',
		items: [{ test: 'HBA1C', status: 'RELEASED', values: { HBA1C: '7.9' }, reviewed: true }],
	});
	await order(ramonFollowUp, {
		clinicalInfo: 'Hypertension; diabetes monitoring',
		items: [{ test: 'HBA1C', status: 'RELEASED', values: { HBA1C: '8.4' }, reviewed: true }],
	});
	await order(await visit('ramon', 'latest'), {
		clinicalInfo: 'Hypertension, on maintenance',
		afterHours: 0.2,
		items: [{ test: 'LIPID', status: 'IN_PROGRESS' }],
	});

	// Jose Ramos: a normal HbA1c at his check-up (reviewed); a CBC requested today for his fever.
	await order(await visit('jose', 20), {
		items: [{ test: 'HBA1C', status: 'RELEASED', values: { HBA1C: '5.4' }, reviewed: true }],
	});
	await order(await visit('jose', 'latest'), {
		priority: 'URGENT',
		clinicalInfo: 'Fever and sore throat for 3 days',
		afterHours: 0.3,
		items: [{ test: 'CBC', status: 'REQUESTED' }],
	});

	// Carmen Torres: a borderline HbA1c released three days ago, still waiting in the doctor's inbox.
	await order(await visit('carmen', 'latest'), {
		items: [{ test: 'HBA1C', status: 'RELEASED', values: { HBA1C: '6.1' }, resultedAfterHours: 72 }],
	});

	// Ana Lopez: an FBS ordered nine days ago and never collected.
	await order(await visit('ana', 'latest'), {
		clinicalInfo: 'Family history of diabetes',
		items: [{ test: 'FBS', status: 'REQUESTED' }],
	});

	// Liza Mendoza: a urinalysis collected, waiting for the run.
	await order(await visit('liza', 'latest'), {
		items: [{ test: 'UA', status: 'SPECIMEN_COLLECTED' }],
	});
}
