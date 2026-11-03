/**
 * Common medicines of the Philippine National Formulary, to suggest while prescribing. Suggestions only: any
 * medicine can be prescribed.
 */
export interface FormularyEntry {
	genericName: string;
	strength: string;
	form: string;
}

export const FORMULARY: readonly FormularyEntry[] = [
	{ genericName: 'Amlodipine', strength: '5 mg', form: 'tablet' },
	{ genericName: 'Amlodipine', strength: '10 mg', form: 'tablet' },
	{ genericName: 'Losartan', strength: '50 mg', form: 'tablet' },
	{ genericName: 'Hydrochlorothiazide', strength: '25 mg', form: 'tablet' },
	{ genericName: 'Metoprolol', strength: '50 mg', form: 'tablet' },
	{ genericName: 'Captopril', strength: '25 mg', form: 'tablet' },
	{ genericName: 'Metformin', strength: '500 mg', form: 'tablet' },
	{ genericName: 'Gliclazide', strength: '80 mg', form: 'tablet' },
	{ genericName: 'Atorvastatin', strength: '20 mg', form: 'tablet' },
	{ genericName: 'Simvastatin', strength: '20 mg', form: 'tablet' },
	{ genericName: 'Aspirin', strength: '80 mg', form: 'tablet' },
	{ genericName: 'Paracetamol', strength: '500 mg', form: 'tablet' },
	{ genericName: 'Paracetamol', strength: '250 mg/5 mL', form: 'syrup' },
	{ genericName: 'Ibuprofen', strength: '400 mg', form: 'tablet' },
	{ genericName: 'Mefenamic acid', strength: '500 mg', form: 'capsule' },
	{ genericName: 'Amoxicillin', strength: '500 mg', form: 'capsule' },
	{ genericName: 'Amoxicillin', strength: '250 mg/5 mL', form: 'suspension' },
	{ genericName: 'Co-amoxiclav', strength: '625 mg', form: 'tablet' },
	{ genericName: 'Cefalexin', strength: '500 mg', form: 'capsule' },
	{ genericName: 'Azithromycin', strength: '500 mg', form: 'tablet' },
	{ genericName: 'Cotrimoxazole', strength: '800 mg/160 mg', form: 'tablet' },
	{ genericName: 'Ciprofloxacin', strength: '500 mg', form: 'tablet' },
	{ genericName: 'Metronidazole', strength: '500 mg', form: 'tablet' },
	{ genericName: 'Salbutamol', strength: '2 mg', form: 'tablet' },
	{ genericName: 'Salbutamol', strength: '100 mcg/dose', form: 'inhaler' },
	{ genericName: 'Cetirizine', strength: '10 mg', form: 'tablet' },
	{ genericName: 'Loratadine', strength: '10 mg', form: 'tablet' },
	{ genericName: 'Omeprazole', strength: '20 mg', form: 'capsule' },
	{ genericName: 'Oral rehydration salts', strength: '20.5 g', form: 'sachet' },
	{ genericName: 'Zinc sulfate', strength: '20 mg/5 mL', form: 'syrup' },
	{ genericName: 'Ferrous sulfate', strength: '325 mg', form: 'tablet' },
	{ genericName: 'Folic acid', strength: '5 mg', form: 'tablet' },
];

export function searchFormulary(query: string, limit = 10): FormularyEntry[] {
	const needle = query.trim().toLowerCase();
	return FORMULARY.filter((entry) => !needle || entry.genericName.toLowerCase().includes(needle)).slice(0, limit);
}
