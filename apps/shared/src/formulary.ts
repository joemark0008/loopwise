/**
 * Common medicines of the Philippine National Formulary, to suggest while prescribing. Suggestions only: any
 * medicine can be prescribed.
 */
export interface FormularyEntry {
	genericName: string;
	strength: string;
	dosageForm: string;
}

export const FORMULARY: readonly FormularyEntry[] = [
	{ genericName: 'Amlodipine', strength: '5 mg', dosageForm: 'tablet' },
	{ genericName: 'Amlodipine', strength: '10 mg', dosageForm: 'tablet' },
	{ genericName: 'Losartan', strength: '50 mg', dosageForm: 'tablet' },
	{ genericName: 'Hydrochlorothiazide', strength: '25 mg', dosageForm: 'tablet' },
	{ genericName: 'Metoprolol', strength: '50 mg', dosageForm: 'tablet' },
	{ genericName: 'Captopril', strength: '25 mg', dosageForm: 'tablet' },
	{ genericName: 'Metformin', strength: '500 mg', dosageForm: 'tablet' },
	{ genericName: 'Gliclazide', strength: '80 mg', dosageForm: 'tablet' },
	{ genericName: 'Atorvastatin', strength: '20 mg', dosageForm: 'tablet' },
	{ genericName: 'Simvastatin', strength: '20 mg', dosageForm: 'tablet' },
	{ genericName: 'Aspirin', strength: '80 mg', dosageForm: 'tablet' },
	{ genericName: 'Paracetamol', strength: '500 mg', dosageForm: 'tablet' },
	{ genericName: 'Paracetamol', strength: '250 mg/5 mL', dosageForm: 'syrup' },
	{ genericName: 'Ibuprofen', strength: '400 mg', dosageForm: 'tablet' },
	{ genericName: 'Mefenamic acid', strength: '500 mg', dosageForm: 'capsule' },
	{ genericName: 'Amoxicillin', strength: '500 mg', dosageForm: 'capsule' },
	{ genericName: 'Amoxicillin', strength: '250 mg/5 mL', dosageForm: 'suspension' },
	{ genericName: 'Co-amoxiclav', strength: '625 mg', dosageForm: 'tablet' },
	{ genericName: 'Cefalexin', strength: '500 mg', dosageForm: 'capsule' },
	{ genericName: 'Azithromycin', strength: '500 mg', dosageForm: 'tablet' },
	{ genericName: 'Cotrimoxazole', strength: '800 mg/160 mg', dosageForm: 'tablet' },
	{ genericName: 'Ciprofloxacin', strength: '500 mg', dosageForm: 'tablet' },
	{ genericName: 'Metronidazole', strength: '500 mg', dosageForm: 'tablet' },
	{ genericName: 'Salbutamol', strength: '2 mg', dosageForm: 'tablet' },
	{ genericName: 'Salbutamol', strength: '100 mcg/dose', dosageForm: 'inhaler' },
	{ genericName: 'Cetirizine', strength: '10 mg', dosageForm: 'tablet' },
	{ genericName: 'Loratadine', strength: '10 mg', dosageForm: 'tablet' },
	{ genericName: 'Omeprazole', strength: '20 mg', dosageForm: 'capsule' },
	{ genericName: 'Oral rehydration salts', strength: '20.5 g', dosageForm: 'sachet' },
	{ genericName: 'Zinc sulfate', strength: '20 mg/5 mL', dosageForm: 'syrup' },
	{ genericName: 'Ferrous sulfate', strength: '325 mg', dosageForm: 'tablet' },
	{ genericName: 'Folic acid', strength: '5 mg', dosageForm: 'tablet' },
];

export function searchFormulary(query: string, limit = 10): FormularyEntry[] {
	const needle = query.trim().toLowerCase();
	return FORMULARY.filter((entry) => !needle || entry.genericName.toLowerCase().includes(needle)).slice(0, limit);
}
