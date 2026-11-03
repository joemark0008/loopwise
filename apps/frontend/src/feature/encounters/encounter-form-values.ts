import { VITAL_FIELDS, vitalsDraftErrors } from '@quarry/shared/vitals';
import { BillDraftSchema, computeBillTotals, FEE_SCHEDULE } from '@quarry/shared/encounter-bill';
import { fieldErrors } from '@quarry/shared/encounter-record';
import { MedicalCertificateDraftSchema } from '@quarry/shared/medical-certificate';
import { PrescriptionDraftSchema } from '@quarry/shared/prescription';
import type { VitalField } from '@quarry/shared/vitals';
import type {
	BillDiscountKind,
	ChargeKind,
	EncounterRecordFieldsFragment,
	MedicationRoute,
	PrescriptionFieldsFragment,
	RecordVitalsInput,
	SaveEncounterBillInput,
	SaveMedicalCertificateInput,
	SavePrescriptionInput,
	UpdateEncounterNoteInput,
	WorkFitness,
} from '@/graphql/generated/graphql';

/*
 * Form values of the encounter page (strings, as inputs hold them) and their mapping to the API inputs. Validation is
 * the shared rules (`@quarry/shared/*`), the same the API applies.
 */

type Encounter = EncounterRecordFieldsFragment['encounter'];

export const NOTE_FIELDS = [
	'reason',
	'history',
	'physicalExam',
	'assessment',
	'plan',
	'patientInstructions',
	'followUpOn',
] as const;
export type NoteFormValues = Record<(typeof NOTE_FIELDS)[number], string>;

export function noteFormFrom(encounter: Encounter): NoteFormValues {
	return {
		reason: encounter.reason ?? '',
		history: encounter.history ?? '',
		physicalExam: encounter.physicalExam ?? '',
		assessment: encounter.assessment ?? '',
		plan: encounter.plan ?? '',
		patientInstructions: encounter.patientInstructions ?? '',
		followUpOn: encounter.followUpOn ?? '',
	};
}

export function toUpdateNoteInput(encounter: Encounter, values: NoteFormValues): UpdateEncounterNoteInput {
	const text = (value: string) => value.trim() || null;
	return {
		encounterId: encounter.id,
		reason: values.reason.trim(),
		history: text(values.history),
		physicalExam: text(values.physicalExam),
		assessment: text(values.assessment),
		plan: text(values.plan),
		patientInstructions: text(values.patientInstructions),
		followUpOn: text(values.followUpOn),
		notes: encounter.notes,
	};
}

export type VitalsFormValues = Record<VitalField, string>;

export const emptyVitalsForm = (): VitalsFormValues =>
	Object.fromEntries(VITAL_FIELDS.map((field) => [field, ''])) as VitalsFormValues;

export const validateVitalsForm = (values: VitalsFormValues) => vitalsDraftErrors(values);

export function toRecordVitalsInput(encounterId: string, values: VitalsFormValues): RecordVitalsInput {
	const input: RecordVitalsInput = { encounterId };
	for (const field of VITAL_FIELDS) {
		const value = values[field].trim();
		if (value !== '') {
			input[field] = Number(value);
		}
	}
	return input;
}

export interface PrescriptionItemFormValues {
	genericName: string;
	brandName: string;
	strength: string;
	form: string;
	dose: string;
	route: MedicationRoute;
	frequency: string;
	durationDays: string;
	quantity: string;
	quantityUnit: string;
	refills: string;
	instructions: string;
}

export interface PrescriptionFormValues {
	id: string | null;
	items: PrescriptionItemFormValues[];
	notes: string;
}

export const emptyPrescriptionItem = (): PrescriptionItemFormValues => ({
	genericName: '',
	brandName: '',
	strength: '',
	form: '',
	dose: '',
	route: 'oral',
	frequency: '',
	durationDays: '',
	quantity: '',
	quantityUnit: '',
	refills: '0',
	instructions: '',
});

/** A draft to edit, or a new one when `prescription` is null. */
export function prescriptionFormFrom(prescription: PrescriptionFieldsFragment | null): PrescriptionFormValues {
	if (!prescription) {
		return { id: null, items: [emptyPrescriptionItem()], notes: '' };
	}
	return {
		id: prescription.id,
		notes: prescription.notes ?? '',
		items: prescription.items.map((item) => ({
			genericName: item.genericName,
			brandName: item.brandName ?? '',
			strength: item.strength ?? '',
			form: item.form ?? '',
			dose: item.dose,
			route: item.route,
			frequency: item.frequency,
			durationDays: item.durationDays?.toString() ?? '',
			quantity: item.quantity.toString(),
			quantityUnit: item.quantityUnit ?? '',
			refills: item.refills.toString(),
			instructions: item.instructions ?? '',
		})),
	};
}

/** Errors keyed `items.0.dose`, `items`, `notes`. */
export const validatePrescriptionForm = (values: PrescriptionFormValues) =>
	fieldErrors(PrescriptionDraftSchema, { items: values.items, notes: values.notes });

export function toSavePrescriptionInput(encounterId: string, values: PrescriptionFormValues): SavePrescriptionInput {
	const text = (value: string) => value.trim() || null;
	const number = (value: string) => (value.trim() === '' ? null : Number(value));
	return {
		id: values.id,
		encounterId,
		notes: text(values.notes),
		items: values.items.map((item) => ({
			genericName: item.genericName.trim(),
			brandName: text(item.brandName),
			strength: text(item.strength),
			form: text(item.form),
			dose: item.dose.trim(),
			route: item.route,
			frequency: item.frequency.trim(),
			durationDays: number(item.durationDays),
			quantity: Number(item.quantity),
			quantityUnit: text(item.quantityUnit),
			refills: number(item.refills) ?? 0,
			instructions: text(item.instructions),
		})),
	};
}

export interface CertificateFormValues {
	id: string | null;
	examinedOn: string;
	diagnosisText: string;
	fitness: WorkFitness;
	restFrom: string;
	restDays: string;
	remarks: string;
	purpose: string;
}

/** A new certificate pre-filled from the encounter: the visit day and its diagnoses (primary first). */
export function newCertificateForm(record: EncounterRecordFieldsFragment): CertificateFormValues {
	const day = record.encounter.startedAt.slice(0, 10);
	const diagnoses = record.diagnoses
		.filter((diagnosis) => !diagnosis.voidedAt)
		.map((diagnosis) => `${diagnosis.display} (${diagnosis.icd10Code})`);
	return {
		id: null,
		examinedOn: day,
		diagnosisText: diagnoses.join('; '),
		fitness: 'fit_to_work',
		restFrom: day,
		restDays: '',
		remarks: '',
		purpose: '',
	};
}

export function certificateFormFrom(certificate: EncounterRecordFieldsFragment['medicalCertificates'][number]) {
	return {
		id: certificate.id,
		examinedOn: certificate.examinedOn,
		diagnosisText: certificate.diagnosisText,
		fitness: certificate.fitness,
		restFrom: certificate.restFrom ?? '',
		restDays: certificate.restDays?.toString() ?? '',
		remarks: certificate.remarks ?? '',
		purpose: certificate.purpose ?? '',
	} satisfies CertificateFormValues;
}

/** Rest start is only asked for together with rest days. */
function certificateDraft(values: CertificateFormValues) {
	return { ...values, restFrom: values.restDays.trim() ? values.restFrom : '' };
}

export const validateCertificateForm = (values: CertificateFormValues) =>
	fieldErrors(MedicalCertificateDraftSchema, certificateDraft(values));

export function toSaveCertificateInput(
	encounterId: string,
	values: CertificateFormValues,
): SaveMedicalCertificateInput {
	const draft = certificateDraft(values);
	const text = (value: string) => value.trim() || null;
	return {
		id: values.id,
		encounterId,
		examinedOn: draft.examinedOn,
		diagnosisText: draft.diagnosisText.trim(),
		fitness: draft.fitness,
		restFrom: text(draft.restFrom),
		restDays: draft.restDays.trim() ? Number(draft.restDays) : null,
		remarks: text(draft.remarks),
		purpose: text(draft.purpose),
	};
}

export interface ChargeFormValues {
	kind: ChargeKind;
	description: string;
	code: string;
	quantity: string;
	unitPrice: string;
}

export interface BillFormValues {
	charges: ChargeFormValues[];
	discountKind: BillDiscountKind | '';
	philhealthPackageCode: string;
	philhealthCoverage: string;
}

/** The draft to edit, or a new bill pre-filled with the consultation and the tests ordered from the visit. */
export function billFormFrom(record: EncounterRecordFieldsFragment): BillFormValues {
	const draft = record.bills.find((bill) => bill.status === 'draft');
	if (draft) {
		return {
			charges: draft.charges.map((charge) => ({
				kind: charge.kind,
				description: charge.description,
				code: charge.code ?? '',
				quantity: charge.quantity.toString(),
				unitPrice: charge.unitPrice.toString(),
			})),
			discountKind: draft.discountKind ?? '',
			philhealthPackageCode: draft.philhealthPackageCode ?? '',
			philhealthCoverage: draft.philhealthCoverage ? draft.philhealthCoverage.toString() : '',
		};
	}
	const fee = (code: string) => FEE_SCHEDULE.find((entry) => entry.code === code);
	const charges = [fee('CONSULT'), ...record.orders.map((order) => fee(order.code))]
		.filter((entry) => entry !== undefined)
		.map((entry) => ({
			kind: entry.kind,
			description: entry.description,
			code: entry.code ?? '',
			quantity: '1',
			unitPrice: entry.unitPrice.toString(),
		}));
	return { charges, discountKind: '', philhealthPackageCode: '', philhealthCoverage: '' };
}

export const emptyCharge = (): ChargeFormValues => ({
	kind: 'other',
	description: '',
	code: '',
	quantity: '1',
	unitPrice: '',
});

export const validateBillForm = (values: BillFormValues) => fieldErrors(BillDraftSchema, values);

/** The totals as you type; the API computes them again from the charges. */
export function billFormTotals(values: BillFormValues) {
	return computeBillTotals(
		values.charges.map((charge) => ({
			quantity: Number(charge.quantity) || 0,
			unitPrice: Number(charge.unitPrice) || 0,
		})),
		values.discountKind || null,
		Number(values.philhealthCoverage) || 0,
	);
}

export function toSaveBillInput(encounterId: string, values: BillFormValues): SaveEncounterBillInput {
	return {
		encounterId,
		charges: values.charges.map((charge) => ({
			kind: charge.kind,
			description: charge.description.trim(),
			code: charge.code.trim() || null,
			quantity: Number(charge.quantity),
			unitPrice: Number(charge.unitPrice),
		})),
		discountKind: values.discountKind || null,
		philhealthPackageCode: values.philhealthPackageCode.trim() || null,
		philhealthCoverage: values.philhealthCoverage.trim() ? Number(values.philhealthCoverage) : null,
	};
}
