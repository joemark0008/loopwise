// Synthetic history for the Wise charts and summary reports (DESIGN.md §7.2): a year of check-ups for Maria Santos
// before her first full visit, with BP, weight and glucose creeping up, and a set of weight / BMI / BP for the other
// patients so the panel scatters have points. Synthetic data only.
//
// Lab-result trends (Maria's earlier HbA1c and FBS, the repeat FBS her referral quotes, Pedro's and Ramon's earlier
// HbA1c) are diagnostic results now: the diagnostics demo seed (`seedDiagnostics`) adds them on these encounters.
import type { Prisma } from '../src/generated/prisma/client.js';
import { type DemoContext, type DemoEncounterKey, icd10 } from './seed-clinical.js';

const MINUTE = 60 * 1000;

/** Maria's check-ups, oldest first: vitals and a working diagnosis (`seedClinicalDemo` created the visits). */
const MARIA_CHECKUPS = [
	{ key: 'mariaCheckup1', bp: [128, 82], hr: 80, weight: 69, glucose: 104, dx: null },
	{ key: 'mariaCheckup2', bp: [132, 84], hr: 82, weight: 70, glucose: 110, dx: 'R03.0' },
	{ key: 'mariaCheckup3', bp: [134, 86], hr: 84, weight: 71, glucose: 118, dx: 'R73.0' },
	{ key: 'mariaCheckup4', bp: [138, 88], hr: 86, weight: 71.5, glucose: 126, dx: 'R03.0' },
] as const satisfies readonly {
	key: DemoEncounterKey;
	bp: readonly [number, number];
	hr: number;
	weight: number;
	glucose: number;
	dx: string | null;
}[];

const MARIA_HEIGHT_CM = 155;

const bmiOf = (weightKg: number, heightCm: number) => Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;

export async function seedTrendHistory(tx: Prisma.TransactionClient, demo: DemoContext): Promise<void> {
	for (const checkup of MARIA_CHECKUPS) {
		const visit = demo.encounters[checkup.key];
		const dx = checkup.dx ? icd10(checkup.dx) : null;
		await tx.encounter.update({
			where: { id: visit.id },
			data: {
				assessment: dx ? dx.description : 'Well adult.',
				plan: 'Low-salt, low-sugar diet and daily walking. Recheck in 3 months.',
				...(dx && { disposition: 'FOR_FOLLOW_UP' }),
			},
		});
		await tx.vitalSigns.create({
			data: {
				encounterId: visit.id,
				systolicBp: checkup.bp[0],
				diastolicBp: checkup.bp[1],
				heartRate: checkup.hr,
				weightKg: checkup.weight,
				heightCm: MARIA_HEIGHT_CM,
				bmi: bmiOf(checkup.weight, MARIA_HEIGHT_CM),
				bloodGlucose: checkup.glucose,
				recordedAt: new Date(visit.startedAt.getTime() + 10 * MINUTE),
				recordedById: demo.staff.nurse,
			},
		});
		if (dx) {
			await tx.encounterDiagnosis.create({
				data: {
					encounterId: visit.id,
					...dx,
					type: 'PRIMARY',
					isFinal: false,
					sortOrder: 0,
					recordedById: demo.staff.doctor,
					recordedAt: visit.startedAt,
				},
			});
		}
	}
}

/** Weight, height and BP at the first visit of the patients with an HbA1c, so HbA1c-vs-BMI scatters have points. */
const PANEL_VITALS = [
	{ key: 'joseCheckup', weightKg: 68, heightCm: 168, systolic: 124, diastolic: 80 },
	{ key: 'pedroVisit', weightKg: 82, heightCm: 165, systolic: 150, diastolic: 95 },
	{ key: 'carmenVisit', weightKg: 61, heightCm: 152, systolic: 132, diastolic: 84 },
	{ key: 'ramonVisit', weightKg: 90, heightCm: 170, systolic: 142, diastolic: 92 },
] as const satisfies readonly {
	key: DemoEncounterKey;
	weightKg: number;
	heightCm: number;
	systolic: number;
	diastolic: number;
}[];

export async function seedPanelVitals(tx: Prisma.TransactionClient, demo: DemoContext): Promise<void> {
	for (const vitals of PANEL_VITALS) {
		const visit = demo.encounters[vitals.key];
		await tx.vitalSigns.create({
			data: {
				encounterId: visit.id,
				systolicBp: vitals.systolic,
				diastolicBp: vitals.diastolic,
				weightKg: vitals.weightKg,
				heightCm: vitals.heightCm,
				bmi: bmiOf(vitals.weightKg, vitals.heightCm),
				recordedAt: new Date(visit.startedAt.getTime() + 5 * MINUTE),
				recordedById: demo.staff.nurse,
			},
		});
	}
}
