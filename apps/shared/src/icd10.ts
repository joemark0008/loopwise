/**
 * A curated list of ICD-10 codes common in Philippine primary care, with their WHO ICD-10 (2010) titles, as
 * PhilHealth uses. Search suggests from it; any code in ICD-10 format is accepted (`ICD10_CODE_PATTERN`).
 */
export interface Icd10Code {
	code: string;
	title: string;
}

/** A category (`I10`) or a subcategory (`E11.9`). */
export const ICD10_CODE_PATTERN = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$/;

export const ICD10_CODES: readonly Icd10Code[] = [
	{ code: 'A01.0', title: 'Typhoid fever' },
	{ code: 'A03.9', title: 'Shigellosis, unspecified' },
	{ code: 'A06.0', title: 'Acute amoebic dysentery' },
	{ code: 'A09.0', title: 'Other and unspecified gastroenteritis and colitis of infectious origin' },
	{ code: 'A09.9', title: 'Gastroenteritis and colitis of unspecified origin' },
	{ code: 'A15.0', title: 'Tuberculosis of lung, confirmed by sputum microscopy with or without culture' },
	{ code: 'A16.2', title: 'Tuberculosis of lung, without mention of bacteriological or histological confirmation' },
	{ code: 'A27.9', title: 'Leptospirosis, unspecified' },
	{ code: 'A90', title: 'Dengue fever [classical dengue]' },
	{ code: 'A91', title: 'Dengue haemorrhagic fever' },
	{ code: 'B01.9', title: 'Varicella without complication' },
	{ code: 'B05.9', title: 'Measles without complication' },
	{ code: 'B18.1', title: 'Chronic viral hepatitis B without delta-agent' },
	{ code: 'B35.4', title: 'Tinea corporis' },
	{ code: 'B36.0', title: 'Pityriasis versicolor' },
	{ code: 'B54', title: 'Unspecified malaria' },
	{ code: 'B82.9', title: 'Intestinal parasitism, unspecified' },
	{ code: 'B86', title: 'Scabies' },
	{ code: 'C50.9', title: 'Malignant neoplasm: Breast, unspecified' },
	{ code: 'D24', title: 'Benign neoplasm of breast' },
	{ code: 'D50.9', title: 'Iron deficiency anaemia, unspecified' },
	{ code: 'D64.9', title: 'Anaemia, unspecified' },
	{ code: 'E03.9', title: 'Hypothyroidism, unspecified' },
	{ code: 'E05.9', title: 'Thyrotoxicosis, unspecified' },
	{ code: 'E10.9', title: 'Insulin-dependent diabetes mellitus without complications' },
	{ code: 'E11.2', title: 'Non-insulin-dependent diabetes mellitus with renal complications' },
	{ code: 'E11.5', title: 'Non-insulin-dependent diabetes mellitus with peripheral circulatory complications' },
	{ code: 'E11.9', title: 'Non-insulin-dependent diabetes mellitus without complications' },
	{ code: 'E14.9', title: 'Unspecified diabetes mellitus without complications' },
	{ code: 'E43', title: 'Unspecified severe protein-energy malnutrition' },
	{ code: 'E44.0', title: 'Moderate protein-energy malnutrition' },
	{ code: 'E66.9', title: 'Obesity, unspecified' },
	{ code: 'E78.0', title: 'Pure hypercholesterolaemia' },
	{ code: 'E78.5', title: 'Hyperlipidaemia, unspecified' },
	{ code: 'E79.0', title: 'Hyperuricaemia without signs of inflammatory arthritis and tophaceous disease' },
	{ code: 'E86', title: 'Volume depletion' },
	{ code: 'F10.2', title: 'Mental and behavioural disorders due to use of alcohol: dependence syndrome' },
	{ code: 'F17.2', title: 'Mental and behavioural disorders due to use of tobacco: dependence syndrome' },
	{ code: 'F32.9', title: 'Depressive episode, unspecified' },
	{ code: 'F41.1', title: 'Generalized anxiety disorder' },
	{ code: 'F41.9', title: 'Anxiety disorder, unspecified' },
	{ code: 'G40.9', title: 'Epilepsy, unspecified' },
	{ code: 'G43.9', title: 'Migraine, unspecified' },
	{ code: 'G44.2', title: 'Tension-type headache' },
	{ code: 'G51.0', title: "Bell's palsy" },
	{ code: 'H10.3', title: 'Acute conjunctivitis, unspecified' },
	{ code: 'H10.9', title: 'Conjunctivitis, unspecified' },
	{ code: 'H26.9', title: 'Cataract, unspecified' },
	{ code: 'H60.9', title: 'Otitis externa, unspecified' },
	{ code: 'H66.9', title: 'Otitis media, unspecified' },
	{ code: 'I10', title: 'Essential (primary) hypertension' },
	{ code: 'I11.9', title: 'Hypertensive heart disease without (congestive) heart failure' },
	{ code: 'I20.9', title: 'Angina pectoris, unspecified' },
	{ code: 'I21.9', title: 'Acute myocardial infarction, unspecified' },
	{ code: 'I25.9', title: 'Chronic ischaemic heart disease, unspecified' },
	{ code: 'I48', title: 'Atrial fibrillation and flutter' },
	{ code: 'I50.0', title: 'Congestive heart failure' },
	{ code: 'I50.9', title: 'Heart failure, unspecified' },
	{ code: 'I63.9', title: 'Cerebral infarction, unspecified' },
	{ code: 'I64', title: 'Stroke, not specified as haemorrhage or infarction' },
	{ code: 'I83.9', title: 'Varicose veins of lower extremities without ulcer or inflammation' },
	{ code: 'J00', title: 'Acute nasopharyngitis [common cold]' },
	{ code: 'J01.9', title: 'Acute sinusitis, unspecified' },
	{ code: 'J02.9', title: 'Acute pharyngitis, unspecified' },
	{ code: 'J03.9', title: 'Acute tonsillitis, unspecified' },
	{ code: 'J06.9', title: 'Acute upper respiratory infection, unspecified' },
	{ code: 'J11.1', title: 'Influenza with other respiratory manifestations, virus not identified' },
	{ code: 'J18.9', title: 'Pneumonia, unspecified' },
	{ code: 'J20.9', title: 'Acute bronchitis, unspecified' },
	{ code: 'J30.4', title: 'Allergic rhinitis, unspecified' },
	{ code: 'J44.1', title: 'Chronic obstructive pulmonary disease with acute exacerbation, unspecified' },
	{ code: 'J44.9', title: 'Chronic obstructive pulmonary disease, unspecified' },
	{ code: 'J45.9', title: 'Asthma, unspecified' },
	{ code: 'K02.9', title: 'Dental caries, unspecified' },
	{ code: 'K21.9', title: 'Gastro-oesophageal reflux disease without oesophagitis' },
	{ code: 'K29.7', title: 'Gastritis, unspecified' },
	{ code: 'K30', title: 'Dyspepsia' },
	{ code: 'K35.9', title: 'Acute appendicitis, unspecified' },
	{ code: 'K40.9', title: 'Unilateral or unspecified inguinal hernia, without obstruction or gangrene' },
	{ code: 'K59.0', title: 'Constipation' },
	{ code: 'K76.0', title: 'Fatty (change of) liver, not elsewhere classified' },
	{ code: 'K80.2', title: 'Calculus of gallbladder without cholecystitis' },
	{ code: 'L01.0', title: 'Impetigo' },
	{ code: 'L02.9', title: 'Cutaneous abscess, furuncle and carbuncle, unspecified' },
	{ code: 'L03.9', title: 'Cellulitis, unspecified' },
	{ code: 'L20.9', title: 'Atopic dermatitis, unspecified' },
	{ code: 'L23.9', title: 'Allergic contact dermatitis, unspecified cause' },
	{ code: 'L30.9', title: 'Dermatitis, unspecified' },
	{ code: 'L50.9', title: 'Urticaria, unspecified' },
	{ code: 'L70.0', title: 'Acne vulgaris' },
	{ code: 'M10.9', title: 'Gout, unspecified' },
	{ code: 'M17.9', title: 'Gonarthrosis, unspecified' },
	{ code: 'M19.9', title: 'Arthrosis, unspecified' },
	{ code: 'M25.5', title: 'Pain in joint' },
	{ code: 'M54.2', title: 'Cervicalgia' },
	{ code: 'M54.5', title: 'Low back pain' },
	{ code: 'M79.1', title: 'Myalgia' },
	{ code: 'M81.9', title: 'Osteoporosis, unspecified' },
	{ code: 'N18.3', title: 'Chronic kidney disease, stage 3' },
	{ code: 'N18.9', title: 'Chronic kidney disease, unspecified' },
	{ code: 'N20.0', title: 'Calculus of kidney' },
	{ code: 'N30.0', title: 'Acute cystitis' },
	{ code: 'N39.0', title: 'Urinary tract infection, site not specified' },
	{ code: 'N40', title: 'Hyperplasia of prostate' },
	{ code: 'N63', title: 'Unspecified lump in breast' },
	{ code: 'N76.0', title: 'Acute vaginitis' },
	{ code: 'N94.6', title: 'Dysmenorrhoea, unspecified' },
	{ code: 'O13', title: 'Gestational [pregnancy-induced] hypertension without significant proteinuria' },
	{ code: 'O14.9', title: 'Pre-eclampsia, unspecified' },
	{ code: 'O21.0', title: 'Mild hyperemesis gravidarum' },
	{ code: 'O24.4', title: 'Diabetes mellitus arising in pregnancy' },
	{ code: 'R03.0', title: 'Elevated blood-pressure reading, without diagnosis of hypertension' },
	{ code: 'R04.0', title: 'Epistaxis' },
	{ code: 'R05', title: 'Cough' },
	{ code: 'R07.4', title: 'Chest pain, unspecified' },
	{ code: 'R10.4', title: 'Other and unspecified abdominal pain' },
	{ code: 'R11', title: 'Nausea and vomiting' },
	{ code: 'R19.7', title: 'Diarrhoea, unspecified' },
	{ code: 'R31', title: 'Unspecified haematuria' },
	{ code: 'R35', title: 'Polyuria' },
	{ code: 'R42', title: 'Dizziness and giddiness' },
	{ code: 'R50.9', title: 'Fever, unspecified' },
	{ code: 'R51', title: 'Headache' },
	{ code: 'R53', title: 'Malaise and fatigue' },
	{ code: 'R59.0', title: 'Localized enlarged lymph nodes' },
	{ code: 'R60.0', title: 'Localized oedema' },
	{ code: 'R63.1', title: 'Polydipsia' },
	{ code: 'R63.4', title: 'Abnormal weight loss' },
	{ code: 'R73.0', title: 'Abnormal glucose tolerance test' },
	{ code: 'R73.9', title: 'Hyperglycaemia, unspecified' },
	{ code: 'R92', title: 'Abnormal findings on diagnostic imaging of breast' },
	{ code: 'S93.4', title: 'Sprain and strain of ankle' },
	{ code: 'T14.0', title: 'Superficial injury of unspecified body region' },
	{ code: 'T14.1', title: 'Open wound of unspecified body region' },
	{ code: 'T30.0', title: 'Burn of unspecified body region, unspecified degree' },
	{ code: 'T78.3', title: 'Angioneurotic oedema' },
	{ code: 'T78.4', title: 'Allergy, unspecified' },
	{ code: 'U07.1', title: 'COVID-19, virus identified' },
	{ code: 'Z00.0', title: 'General medical examination' },
	{ code: 'Z02.1', title: 'Pre-employment examination' },
	{ code: 'Z02.7', title: 'Issue of medical certificate' },
	{ code: 'Z12.3', title: 'Special screening examination for neoplasm of breast' },
	{ code: 'Z12.4', title: 'Special screening examination for neoplasm of cervix' },
	{ code: 'Z13.1', title: 'Special screening examination for diabetes mellitus' },
	{ code: 'Z20.3', title: 'Contact with and exposure to rabies' },
	{ code: 'Z30.0', title: 'General counselling and advice on contraception' },
	{ code: 'Z34.9', title: 'Supervision of normal pregnancy, unspecified' },
	{ code: 'Z72.0', title: 'Tobacco use' },
	{ code: 'Z76.0', title: 'Issue of repeat prescription' },
];

const BY_CODE = new Map(ICD10_CODES.map((entry) => [entry.code, entry]));

/** `e11.9 ` → `E11.9`; `E119` → `E11.9`. */
export function normalizeIcd10Code(code: string): string {
	const compact = code.trim().toUpperCase().replace(/\s+/g, '');
	return /^[A-Z][0-9]{2}[0-9A-Z]{1,2}$/.test(compact) ? `${compact.slice(0, 3)}.${compact.slice(3)}` : compact;
}

export function findIcd10(code: string): Icd10Code | undefined {
	return BY_CODE.get(normalizeIcd10Code(code));
}

/** Codes starting with the query first, then titles containing every word of it. */
export function searchIcd10(query: string, limit = 20): Icd10Code[] {
	const trimmed = query.trim();
	if (!trimmed) {
		return ICD10_CODES.slice(0, limit);
	}
	const code = normalizeIcd10Code(trimmed);
	const words = trimmed.toLowerCase().split(/\s+/);
	const byCode = ICD10_CODES.filter((entry) => entry.code.startsWith(code));
	const byTitle = ICD10_CODES.filter(
		(entry) => !byCode.includes(entry) && words.every((word) => entry.title.toLowerCase().includes(word)),
	);
	return [...byCode, ...byTitle].slice(0, limit);
}
