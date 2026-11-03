/** The chapters of ICD-10 (WHO 2019), by code range: the facility panel counts diagnoses per chapter. */
export const ICD10_CHAPTERS = [
	{ from: 'A00', to: 'B99', title: 'Infectious and parasitic diseases' },
	{ from: 'C00', to: 'D48', title: 'Neoplasms' },
	{ from: 'D50', to: 'D89', title: 'Blood and immune disorders' },
	{ from: 'E00', to: 'E90', title: 'Endocrine, nutritional and metabolic' },
	{ from: 'F00', to: 'F99', title: 'Mental and behavioural' },
	{ from: 'G00', to: 'G99', title: 'Nervous system' },
	{ from: 'H00', to: 'H59', title: 'Eye' },
	{ from: 'H60', to: 'H95', title: 'Ear' },
	{ from: 'I00', to: 'I99', title: 'Circulatory system' },
	{ from: 'J00', to: 'J99', title: 'Respiratory system' },
	{ from: 'K00', to: 'K93', title: 'Digestive system' },
	{ from: 'L00', to: 'L99', title: 'Skin' },
	{ from: 'M00', to: 'M99', title: 'Musculoskeletal' },
	{ from: 'N00', to: 'N99', title: 'Genitourinary system' },
	{ from: 'O00', to: 'O99', title: 'Pregnancy and childbirth' },
	{ from: 'P00', to: 'P96', title: 'Perinatal conditions' },
	{ from: 'Q00', to: 'Q99', title: 'Congenital anomalies' },
	{ from: 'R00', to: 'R99', title: 'Symptoms and abnormal findings' },
	{ from: 'S00', to: 'T98', title: 'Injury and poisoning' },
	{ from: 'V01', to: 'Y98', title: 'External causes' },
	{ from: 'Z00', to: 'Z99', title: 'Health status and services' },
	{ from: 'U00', to: 'U99', title: 'Special purposes' },
] as const;

/** `E11.9` → "Endocrine, nutritional and metabolic (E00–E90)"; null for a code outside every chapter. */
export function icd10Chapter(code: string): string | null {
	const category = code.trim().toUpperCase().slice(0, 3);
	const chapter = ICD10_CHAPTERS.find((entry) => category >= entry.from && category <= entry.to);
	return chapter ? `${chapter.title} (${chapter.from}–${chapter.to})` : null;
}
