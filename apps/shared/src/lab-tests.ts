/**
 * The tests a clinician orders from an encounter in the prototype (LOINC). The orders module (DESIGN.md §15,
 * Days 4–6) may replace this with a facility catalog.
 */
export interface LabTest {
	code: string;
	display: string;
	kind: 'lab' | 'imaging';
}

export const LAB_TESTS: readonly LabTest[] = [
	{ code: '4548-4', display: 'Hemoglobin A1c', kind: 'lab' },
	{ code: '1558-6', display: 'Fasting glucose', kind: 'lab' },
	{ code: '57698-3', display: 'Lipid panel', kind: 'lab' },
	{ code: '58410-2', display: 'Complete blood count (CBC)', kind: 'lab' },
	{ code: '2160-0', display: 'Creatinine', kind: 'lab' },
	{ code: '3084-1', display: 'Uric acid', kind: 'lab' },
	{ code: '1742-6', display: 'ALT (SGPT)', kind: 'lab' },
	{ code: '2823-3', display: 'Potassium', kind: 'lab' },
	{ code: '24356-8', display: 'Urinalysis', kind: 'lab' },
	{ code: '11545-1', display: 'Sputum AFB smear', kind: 'lab' },
	{ code: '11524-6', display: 'ECG (12-lead)', kind: 'imaging' },
	{ code: '36643-5', display: 'Chest X-ray (2 views)', kind: 'imaging' },
	{ code: '24606-6', display: 'MG Breast Screening', kind: 'imaging' },
	{ code: '24601-7', display: 'Breast ultrasound', kind: 'imaging' },
];

export function findLabTest(code: string): LabTest | undefined {
	return LAB_TESTS.find((test) => test.code === code);
}
