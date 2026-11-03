// Synthetic history for the Wise charts and summary reports (DESIGN.md §9.2): a year of check-ups for Maria Santos
// before her first full visit, with BP, weight and glucose creeping up, an earlier HbA1c and FBS, and the repeat FBS
// her referral mentions. Pedro Villanueva and Ramon Gonzaga get an earlier HbA1c so the panel isn't flat. Synthetic
// data only. Idempotent: skipped once Maria has an encounter older than her first full visit.
import type { Prisma } from '../src/generated/prisma/client.js';

const DAY = 24 * 60 * 60 * 1000;

const LOINC = {
	hba1c: { code: '4548-4', display: 'Hemoglobin A1c', unit: '%', refRange: '4.0-5.6' },
	fbs: { code: '1558-6', display: 'Fasting glucose', unit: 'mg/dL', refRange: '70-99' },
} as const;

/** Maria's check-ups, oldest first: days before her first full visit, vitals and a working diagnosis. */
const MARIA_CHECKUPS = [
	{ before: 360, reason: 'Annual check-up', bp: [128, 82], hr: 80, weight: 69, glucose: 104, dx: null },
	{
		before: 270,
		reason: 'Follow-up of BP reading',
		bp: [132, 84],
		hr: 82,
		weight: 70,
		glucose: 110,
		dx: { icd10Code: 'R03.0', display: 'Elevated blood-pressure reading, without diagnosis of hypertension' },
	},
	{
		before: 180,
		reason: 'Fasting blood sugar review',
		bp: [134, 86],
		hr: 84,
		weight: 71,
		glucose: 118,
		dx: { icd10Code: 'R73.0', display: 'Abnormal glucose tolerance test' },
	},
	{
		before: 90,
		reason: 'Headache, BP check',
		bp: [138, 88],
		hr: 86,
		weight: 71.5,
		glucose: 126,
		dx: { icd10Code: 'R03.0', display: 'Elevated blood-pressure reading, without diagnosis of hypertension' },
	},
] as const;

export async function seedTrendHistory(tx: Prisma.TransactionClient): Promise<boolean> {
	const healthCenter = await tx.organization.findUnique({ where: { slug: 'tagbilaran-hc' } });
	const lab = await tx.organization.findUnique({ where: { slug: 'bohol-diagnostics' } });
	const reyes = await tx.user.findUnique({ where: { email: 'dr.reyes@loopwise.test' } });
	if (!healthCenter || !lab || !reyes) {
		return false;
	}
	const firstVisit = (givenName: string, familyName: string) =>
		tx.encounter.findFirst({
			where: { patient: { givenName, familyName }, orgId: healthCenter.id },
			orderBy: { startedAt: 'asc' },
		});

	const maria = await firstVisit('Maria', 'Santos');
	if (!maria) {
		return false;
	}
	const visitDay = maria.startedAt.getTime();
	if (
		await tx.encounter.findFirst({
			where: { patientId: maria.patientId, startedAt: { lt: new Date(visitDay - 30 * DAY) } },
		})
	) {
		return false;
	}

	const labResult = async (
		patientId: string,
		encounterId: string,
		test: (typeof LOINC)[keyof typeof LOINC],
		value: number,
		flag: 'normal' | 'high',
		resultedAt: Date,
	) => {
		const order = await tx.clinicalOrder.create({
			data: {
				encounterId,
				patientId,
				orderingDoctorId: reyes.id,
				orderingOrgId: healthCenter.id,
				targetOrgId: lab.id,
				code: test.code,
				display: test.display,
				status: 'reviewed',
				sentAt: new Date(resultedAt.getTime() - 2 * DAY),
			},
		});
		await tx.result.create({
			data: {
				orderId: order.id,
				patientId,
				sourceOrgId: lab.id,
				code: test.code,
				display: test.display,
				value: String(value),
				valueNumeric: value,
				unit: test.unit,
				refRange: test.refRange,
				flag,
				resultedAt,
				reviewedAt: new Date(resultedAt.getTime() + DAY / 2),
				reviewedById: reyes.id,
			},
		});
	};

	for (const checkup of MARIA_CHECKUPS) {
		const startedAt = new Date(visitDay - checkup.before * DAY);
		const encounter = await tx.encounter.create({
			data: {
				patientId: maria.patientId,
				doctorId: reyes.id,
				orgId: healthCenter.id,
				reason: checkup.reason,
				startedAt,
				assessment: checkup.dx ? checkup.dx.display : 'Well adult.',
				plan: 'Low-salt, low-sugar diet and daily walking. Recheck in 3 months.',
			},
		});
		const base = { encounterId: encounter.id, patientId: maria.patientId, orgId: healthCenter.id };
		await tx.vitalSigns.create({
			data: {
				...base,
				systolicMmHg: checkup.bp[0],
				diastolicMmHg: checkup.bp[1],
				heartRateBpm: checkup.hr,
				weightKg: checkup.weight,
				heightCm: 155,
				bmi: Math.round((checkup.weight / 1.55 ** 2) * 10) / 10,
				bloodGlucoseMgDl: checkup.glucose,
				recordedAt: new Date(startedAt.getTime() + 10 * 60 * 1000),
				recordedById: reyes.id,
			},
		});
		if (checkup.dx) {
			await tx.encounterDiagnosis.create({
				data: { ...base, ...checkup.dx, isPrimary: true, rank: 0, recordedById: reyes.id },
			});
		}
		if (checkup.before === 180) {
			const resultedAt = new Date(startedAt.getTime() + 2 * DAY);
			await labResult(maria.patientId, encounter.id, LOINC.hba1c, 6.1, 'high', resultedAt);
			await labResult(maria.patientId, encounter.id, LOINC.fbs, 112, 'high', resultedAt);
		}
	}
	// The repeat FBS her referral quotes, a day after the HbA1c of her first full visit.
	await labResult(maria.patientId, maria.id, LOINC.fbs, 131, 'high', new Date(visitDay + 3 * DAY));

	for (const [givenName, familyName, earlier] of [
		['Pedro', 'Villanueva', 9.4],
		['Ramon', 'Gonzaga', 7.9],
	] as const) {
		const visit = await firstVisit(givenName, familyName);
		if (visit) {
			await labResult(
				visit.patientId,
				visit.id,
				LOINC.hba1c,
				earlier,
				'high',
				new Date(visit.startedAt.getTime() - 120 * DAY),
			);
		}
	}
	return true;
}

/** Tagbilaran City barangays for the synthetic patients (analytics breakdowns). Idempotent: only fills blanks. */
const BARANGAYS: Record<string, string> = {
	'Maria Santos': 'Cogon',
	'Jose Ramos': 'Dao',
	'Liza Mendoza': 'Cogon',
	'Pedro Villanueva': 'Booy',
	'Ana Lopez': 'Manga',
	'Carmen Torres': 'Dao',
	'Ramon Gonzaga': 'Taloto',
};

export async function seedBarangays(tx: Prisma.TransactionClient): Promise<void> {
	for (const [name, barangay] of Object.entries(BARANGAYS)) {
		const [givenName, familyName] = name.split(' ');
		await tx.patient.updateMany({ where: { givenName, familyName, barangay: null }, data: { barangay } });
	}
}

/** Synthetic weight and BMI for the patients with an HbA1c, so HbA1c-vs-BMI scatters have points. Fills blanks only. */
const PANEL_VITALS: Record<string, { weightKg: number; heightCm: number; systolic: number; diastolic: number }> = {
	'Jose Ramos': { weightKg: 68, heightCm: 168, systolic: 124, diastolic: 80 },
	'Pedro Villanueva': { weightKg: 82, heightCm: 165, systolic: 150, diastolic: 95 },
	'Carmen Torres': { weightKg: 61, heightCm: 152, systolic: 132, diastolic: 84 },
	'Ramon Gonzaga': { weightKg: 90, heightCm: 170, systolic: 142, diastolic: 92 },
};

export async function seedPanelVitals(tx: Prisma.TransactionClient): Promise<void> {
	const reyes = await tx.user.findUnique({ where: { email: 'dr.reyes@loopwise.test' } });
	if (!reyes) {
		return;
	}
	for (const [name, vitals] of Object.entries(PANEL_VITALS)) {
		const [givenName, familyName] = name.split(' ');
		const visit = await tx.encounter.findFirst({
			where: { patient: { givenName, familyName } },
			orderBy: { startedAt: 'asc' },
		});
		if (!visit || (await tx.vitalSigns.count({ where: { patientId: visit.patientId } })) > 0) {
			continue;
		}
		await tx.vitalSigns.create({
			data: {
				encounterId: visit.id,
				patientId: visit.patientId,
				orgId: visit.orgId,
				systolicMmHg: vitals.systolic,
				diastolicMmHg: vitals.diastolic,
				weightKg: vitals.weightKg,
				heightCm: vitals.heightCm,
				bmi: Math.round((vitals.weightKg / (vitals.heightCm / 100) ** 2) * 10) / 10,
				recordedAt: visit.startedAt,
				recordedById: reyes.id,
			},
		});
	}
}
