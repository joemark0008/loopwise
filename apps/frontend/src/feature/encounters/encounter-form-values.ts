import { VITAL_FIELDS, vitalsDraftErrors } from '@loopwise/shared/vitals';
import { fieldErrors } from '@loopwise/shared/encounter-record';
import { MedicalCertificateDraftSchema } from '@loopwise/shared/medical-certificate';
import { composeSig, MEDICATION_ROUTES, PrescriptionDraftSchema } from '@loopwise/shared/prescription';
import type { CertificateType } from '@loopwise/shared/medical-certificate';
import type { MedicationRoute } from '@loopwise/shared/prescription';
import type { Disposition } from '@loopwise/shared/encounter-record';
import type { VitalField } from '@loopwise/shared/vitals';
import type {
	EncounterRecordFieldsFragment,
	MedicalCertificateFieldsFragment,
	PrescriptionFieldsFragment,
	RecordVitalsInput,
	SaveMedicalCertificateInput,
	SavePrescriptionInput,
	UpdateEncounterNoteInput,
} from '@/graphql/generated/graphql';

/*
 * Form values of the encounter page (strings, as inputs hold them) and their mapping to the API inputs. Validation is
 * the shared rules (`@loopwise/shared/*`), the same the API applies.
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
/** The note as the inputs hold it; `disposition` is empty until chosen. */
export type NoteFormValues = Record<(typeof NOTE_FIELDS)[number], string> & { disposition: Disposition | '' };

export function noteFormFrom(encounter: Encounter): NoteFormValues {
	return {
		reason: encounter.reason ?? '',
		history: encounter.history ?? '',
		physicalExam: encounter.physicalExam ?? '',
		assessment: encounter.assessment ?? '',
		plan: encounter.plan ?? '',
		patientInstructions: encounter.patientInstructions ?? '',
		followUpOn: encounter.followUpOn ?? '',
		disposition: encounter.disposition ?? '',
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
		disposition: values.disposition || null,
		notes: encounter.notes,
		expectedVersion: encounter.version,
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
	dosageForm: string;
	/** Per intake, e.g. "1 tablet": writes the sig when the sig is left empty. */
	dose: string;
	route: MedicationRoute;
	frequency: string;
	durationDays: string;
	isPrn: boolean;
	sig: string;
	quantity: string;
	unit: string;
	quantityInWords: string;
}

export interface PrescriptionFormValues {
	id: string | null;
	items: PrescriptionItemFormValues[];
	notes: string;
	isDangerousDrug: boolean;
	s2FormSerialNo: string;
}

export const emptyPrescriptionItem = (): PrescriptionItemFormValues => ({
	genericName: '',
	brandName: '',
	strength: '',
	dosageForm: '',
	dose: '',
	route: 'PO',
	frequency: '',
	durationDays: '',
	isPrn: false,
	sig: '',
	quantity: '',
	unit: '',
	quantityInWords: '',
});

const asRoute = (value: string | null): MedicationRoute =>
	(MEDICATION_ROUTES as readonly string[]).includes(value ?? '') ? (value as MedicationRoute) : 'PO';

/** A draft to edit, or a new one when `prescription` is null. The stored sig is edited as is. */
export function prescriptionFormFrom(
	prescription: Pick<
		PrescriptionFieldsFragment,
		'id' | 'notes' | 'isDangerousDrug' | 's2FormSerialNo' | 'items'
	> | null,
): PrescriptionFormValues {
	if (!prescription) {
		return { id: null, items: [emptyPrescriptionItem()], notes: '', isDangerousDrug: false, s2FormSerialNo: '' };
	}
	return {
		id: prescription.id,
		notes: prescription.notes ?? '',
		isDangerousDrug: prescription.isDangerousDrug,
		s2FormSerialNo: prescription.s2FormSerialNo ?? '',
		items: prescription.items.map((item) => ({
			genericName: item.genericName,
			brandName: item.brandName ?? '',
			strength: item.strength ?? '',
			dosageForm: item.dosageForm ?? '',
			dose: '',
			route: asRoute(item.route),
			frequency: item.frequency ?? '',
			durationDays: item.durationDays?.toString() ?? '',
			isPrn: item.isPrn,
			sig: item.sig,
			quantity: item.quantity.toString(),
			unit: item.unit ?? '',
			quantityInWords: item.quantityInWords ?? '',
		})),
	};
}

function prescriptionDraft(values: PrescriptionFormValues) {
	return {
		items: values.items,
		notes: values.notes,
		isDangerousDrug: values.isDangerousDrug,
		s2FormSerialNo: values.s2FormSerialNo,
	};
}

/** Errors keyed `items.0.sig`, `items`, `notes`. */
export const validatePrescriptionForm = (values: PrescriptionFormValues) =>
	fieldErrors(PrescriptionDraftSchema, prescriptionDraft(values));

/** The sig the API will store for an item (the one typed, else written from dose, route and frequency). */
export const itemSig = (item: PrescriptionItemFormValues): string =>
	item.sig.trim() ||
	composeSig({
		dose: item.dose.trim() || null,
		route: item.route,
		frequency: item.frequency.trim() || null,
		durationDays: item.durationDays.trim() ? Number(item.durationDays) : null,
		isPrn: item.isPrn,
	});

export function toSavePrescriptionInput(encounterId: string, values: PrescriptionFormValues): SavePrescriptionInput {
	const text = (value: string) => value.trim() || null;
	const number = (value: string) => (value.trim() === '' ? null : Number(value));
	return {
		id: values.id,
		encounterId,
		notes: text(values.notes),
		isDangerousDrug: values.isDangerousDrug,
		s2FormSerialNo: values.isDangerousDrug ? text(values.s2FormSerialNo) : null,
		items: values.items.map((item) => ({
			genericName: item.genericName.trim(),
			brandName: text(item.brandName),
			strength: text(item.strength),
			dosageForm: text(item.dosageForm),
			dose: text(item.dose),
			route: item.route,
			frequency: text(item.frequency),
			durationDays: number(item.durationDays),
			isPrn: item.isPrn,
			sig: text(item.sig),
			quantity: Number(item.quantity),
			unit: text(item.unit),
			quantityInWords: text(item.quantityInWords),
		})),
	};
}

/** Fit to work: `fit`, `unfit`, or `` (not stated). */
export type FitnessValue = 'fit' | 'unfit' | '';

export interface CertificateFormValues {
	id: string | null;
	type: CertificateType;
	examinedOn: string;
	diagnosisText: string;
	findings: string;
	recommendation: string;
	fitness: FitnessValue;
	restFrom: string;
	restDays: string;
	purpose: string;
}

/** A new certificate pre-filled from the encounter: the visit day and its diagnoses (primary first). */
export function newCertificateForm(
	record: Pick<EncounterRecordFieldsFragment, 'encounter' | 'diagnoses'>,
): CertificateFormValues {
	const day = record.encounter.startedAt.slice(0, 10);
	const diagnoses = record.diagnoses
		.filter((diagnosis) => !diagnosis.voidedAt)
		.map((diagnosis) => `${diagnosis.description}${diagnosis.icd10Code ? ` (${diagnosis.icd10Code})` : ''}`);
	return {
		id: null,
		type: 'MEDICAL_CERTIFICATE',
		examinedOn: day,
		diagnosisText: diagnoses.join('; '),
		findings: '',
		recommendation: '',
		fitness: 'fit',
		restFrom: day,
		restDays: '',
		purpose: '',
	};
}

const fitnessOf = (isFitToWork: boolean | null | undefined): FitnessValue =>
	isFitToWork === true ? 'fit' : isFitToWork === false ? 'unfit' : '';

export function certificateFormFrom(certificate: MedicalCertificateFieldsFragment): CertificateFormValues {
	return {
		id: certificate.id,
		type: certificate.type,
		examinedOn: certificate.examinedOn,
		diagnosisText: certificate.diagnosisText ?? '',
		findings: certificate.findings ?? '',
		recommendation: certificate.recommendation ?? '',
		fitness: fitnessOf(certificate.isFitToWork),
		restFrom: certificate.restFrom ?? '',
		restDays: certificate.restDays?.toString() ?? '',
		purpose: certificate.purpose ?? '',
	};
}

/** Rest start is only asked for together with rest days; fitness maps to `isFitToWork`. */
function certificateDraft(values: CertificateFormValues) {
	const { fitness, id: _id, ...rest } = values;
	return {
		...rest,
		isFitToWork: fitness === '' ? undefined : fitness === 'fit',
		restFrom: values.restDays.trim() ? values.restFrom : '',
	};
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
		type: draft.type,
		examinedOn: draft.examinedOn,
		diagnosisText: draft.diagnosisText.trim(),
		findings: text(draft.findings),
		recommendation: text(draft.recommendation),
		isFitToWork: draft.isFitToWork ?? null,
		restFrom: text(draft.restFrom),
		restDays: draft.restDays.trim() ? Number(draft.restDays) : null,
		purpose: text(draft.purpose),
	};
}
