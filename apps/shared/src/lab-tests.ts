/**
 * The standard diagnostic tests (the catalog the demo organization is seeded with, `prisma/seed-diagnostics.ts`), by
 * the catalog code each organization's `diagnostic_tests.code` uses, with their LOINC code (`lis_code`) and the names
 * clinicians say. Wise resolves the tests a clinician names against this list (`propose_order`); the card then picks
 * them from the organization's own catalog (`diagnosticTests`) by code, so a test the clinic does not offer is
 * refused there.
 */

/** Mirrors the API's `DiagnosticCategory`. */
export const DIAGNOSTIC_CATEGORIES = ['LABORATORY', 'IMAGING', 'CARDIO', 'OTHER'] as const;
export type DiagnosticCategory = (typeof DIAGNOSTIC_CATEGORIES)[number];

export interface LabTest {
	/** The catalog code (`diagnostic_tests.code`), unique per organization. */
	code: string;
	/** LOINC (`diagnostic_tests.lis_code`); null when the test has none in use here. */
	loinc: string | null;
	display: string;
	category: DiagnosticCategory;
	/** What clinicians call it, lower case. */
	aliases: readonly string[];
}

export const LAB_TESTS: readonly LabTest[] = [
	{
		code: 'HBA1C',
		loinc: '4548-4',
		display: 'Hemoglobin A1c (HbA1c)',
		category: 'LABORATORY',
		aliases: ['hba1c', 'a1c', 'glycated hemoglobin', 'hemoglobin a1c'],
	},
	{
		code: 'FBS',
		loinc: '1558-6',
		display: 'Fasting blood sugar (FBS)',
		category: 'LABORATORY',
		aliases: ['fbs', 'fasting blood sugar', 'fasting blood glucose', 'fasting glucose'],
	},
	{
		code: 'LIPID',
		loinc: '57698-3',
		display: 'Lipid profile',
		category: 'LABORATORY',
		aliases: ['lipids', 'lipid panel', 'lipid profile', 'cholesterol'],
	},
	{
		code: 'CBC',
		loinc: '58410-2',
		display: 'Complete blood count (CBC)',
		category: 'LABORATORY',
		aliases: ['cbc', 'complete blood count', 'cbc with platelet'],
	},
	{
		code: 'UA',
		loinc: '24356-8',
		display: 'Urinalysis',
		category: 'LABORATORY',
		aliases: ['ua', 'urinalysis', 'urine test'],
	},
	{
		code: 'CXR-PA',
		loinc: null,
		display: 'Chest X-ray PA',
		category: 'IMAGING',
		aliases: ['cxr', 'chest x-ray', 'chest xray', 'chest x-ray pa', 'cxr pa'],
	},
];

/**
 * The standard test a clinician named: by catalog code, LOINC, name or a usual abbreviation (case-insensitive);
 * undefined when it is not one of them.
 */
export function findLabTest(name: string): LabTest | undefined {
	const key = name.trim().toLowerCase();
	if (!key) {
		return undefined;
	}
	return (
		LAB_TESTS.find((test) => test.code.toLowerCase() === key || test.loinc === key) ??
		LAB_TESTS.find((test) => test.aliases.includes(key) || test.display.toLowerCase() === key) ??
		LAB_TESTS.find((test) => test.display.toLowerCase().startsWith(key))
	);
}
