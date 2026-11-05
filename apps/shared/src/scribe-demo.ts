import type { Input as ScribeDraft } from './tools/propose-scribe-note';

/**
 * A synthetic consultation for the AI scribe demo and tests (never real patient data): Maria Santos, the seed's 45-year-
 * old patient from Cogon, back for her hypertension and type 2 diabetes. Doctor and patient switch between English and
 * Cebuano, as a Bohol consult does; the doctor dictates the findings and the plan at the end.
 */
export const SCRIBE_DEMO_TRANSCRIPT = [
	'Doctor: Maayong buntag, Maria. Follow-up ta karon sa imong BP ug sugar. Kumusta ka?',
	'Patient: Okay ra man, Doc, pero usahay sakit akong ulo sa hapon. Ang metformin ginainom nako adlaw-adlaw, pero ang amlodipine usahay makalimtan nako.',
	'Doctor: Naa bay sakit sa dughan, lisod ginhawa, o nagbuling ang panan-aw?',
	'Patient: Wala man, Doc. Pero kanunay pa gihapon ko ihi sa gabii.',
	'Doctor: Dictating. BP 150 over 95, heart rate 84, weight 68 kilos, height 155 centimeters, capillary blood glucose 182.',
	'Chest clear, heart regular rhythm, no murmur, no pedal edema. HbA1c last visit was 7.2 percent.',
	'Assessment: essential hypertension, not at goal; type 2 diabetes without complications, suboptimally controlled.',
	'Plan: continue metformin 500 milligrams, one tablet twice a day with meals for 30 days, sixty tablets.',
	'Increase amlodipine to 10 milligrams once a day for 30 days, thirty tablets. Add losartan 50 milligrams once a day for 30 days, thirty tablets.',
	'Request HbA1c, fasting blood sugar, lipid profile and serum creatinine. Low-salt diet, walk thirty minutes a day.',
	'She needs a medical certificate for work, rest for one day. Follow-up in two weeks with the results.',
	'Patient summary in Cebuano, please.',
].join('\n');

/** What a careful scribe draws from `SCRIBE_DEMO_TRANSCRIPT` (the scripted model of the tests sends it). */
export const scribeDemoDraft = (encounterId: string): ScribeDraft => ({
	encounterId,
	soap: {
		chiefComplaint: 'Follow-up of hypertension and diabetes; afternoon headaches',
		history:
			'45-year-old woman on follow-up for hypertension and type 2 diabetes. Occasional afternoon headaches. Takes metformin daily; sometimes forgets amlodipine.',
		reviewOfSystems: 'No chest pain, dyspnea or blurred vision. Persistent nocturia.',
		subjective: 'Adherent to metformin; misses amlodipine doses at times.',
		physicalExam: 'Chest clear. Heart: regular rhythm, no murmur. No pedal edema.',
		objective: 'CBG 182 mg/dL. HbA1c 7.2% at the last visit.',
		assessment:
			'Essential hypertension, not at goal. Type 2 diabetes mellitus without complications, suboptimally controlled.',
		plan: 'Continue metformin 500 mg BID with meals. Increase amlodipine to 10 mg OD. Add losartan 50 mg OD. HbA1c, FBS, lipid profile, serum creatinine. Low-salt diet, walk 30 minutes a day. Follow up in 2 weeks with results.',
	},
	vitals: {
		systolicMmHg: 150,
		diastolicMmHg: 95,
		heartRateBpm: 84,
		weightKg: 68,
		heightCm: 155,
		bloodGlucoseMgDl: 182,
	},
	diagnoses: [
		{ icd10Code: 'I10', description: 'Essential (primary) hypertension', type: 'PRIMARY' },
		{
			icd10Code: 'E11.9',
			description: 'Type 2 diabetes mellitus without complications',
			type: 'SECONDARY',
		},
	],
	prescription: {
		items: [
			{
				genericName: 'Metformin',
				strength: '500 mg',
				dosageForm: 'tablet',
				dose: '1 tablet',
				frequency: 'twice a day with meals',
				durationDays: 30,
				quantity: 60,
				unit: 'tablets',
			},
			{
				genericName: 'Amlodipine',
				strength: '10 mg',
				dosageForm: 'tablet',
				dose: '1 tablet',
				frequency: 'once a day',
				durationDays: 30,
				quantity: 30,
				unit: 'tablets',
			},
			{
				genericName: 'Losartan',
				strength: '50 mg',
				dosageForm: 'tablet',
				dose: '1 tablet',
				frequency: 'once a day',
				durationDays: 30,
				quantity: 30,
				unit: 'tablets',
			},
		],
		notes: 'Low-salt diet. Walk 30 minutes a day.',
	},
	orders: {
		tests: ['HbA1c', 'FBS', 'lipid profile', 'serum creatinine'],
		clinicalInfo: 'Hypertension not at goal; T2DM',
	},
	medicalCertificate: { restDays: 1, isFitToWork: false, purpose: 'work', recommendation: 'Rest for one day.' },
	followUp: { inDays: 14, disposition: 'FOR_FOLLOW_UP' },
	patientSummary: {
		language: 'ceb',
		text: [
			'Maria, taas pa gihapon ang imong presyon (150/95) ug ang imong sugar. Atong usbon ang imong tambal:',
			'ipadayon ang metformin 500 mg, usa ka tableta kaduha sa usa ka adlaw uban sa pagkaon; ang amlodipine',
			'himoon nang 10 mg kausa sa usa ka adlaw; ug dugangan og losartan 50 mg kausa sa usa ka adlaw. Ayaw kalimti',
			'ang imong tambal adlaw-adlaw. Pagpa-laboratory: HbA1c, FBS, lipid profile ug creatinine. Pagkunhod sa asin',
			'ug paglakaw 30 minutos matag adlaw. Balik dinhi human sa duha ka semana dala ang resulta.',
		].join(' '),
	},
});
