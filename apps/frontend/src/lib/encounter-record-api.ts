import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	AddAllergyDocument,
	AddDiagnosisDocument,
	EncounterRecordDocument,
	IssueMedicalCertificateDocument,
	IssuePrescriptionDocument,
	MedicalCertificatePrintDocument,
	MyPractitionerDocument,
	PatientAllergiesDocument,
	PrescriptionPrintDocument,
	RecordVitalsDocument,
	SaveMedicalCertificateDocument,
	SaveMyPractitionerDocument,
	SavePrescriptionDocument,
	SearchIcd10Document,
	UpdateDiagnosisDocument,
	UpdateEncounterNoteDocument,
	VoidAllergyDocument,
	VoidDiagnosisDocument,
	VoidMedicalCertificateDocument,
	VoidPrescriptionDocument,
	VoidVitalsDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['encounterRecord'];
type Outputs = ApiOutputs['encounterRecord'];
type Key = keyof Inputs;

const path = (name: Key) => ['encounterRecord', name] as const;

/**
 * The encounter record (`apps/api/src/clinical/{encounters,patients,prescriptions,documents,practitioners}`): the
 * encounter page, its print views and the practitioner profile. Writes return ids; the page refetches the record.
 */
export const encounterRecordApi = {
	encounterRecord: {
		get: query<Inputs['get'], Outputs['get']>(
			path('get'),
			async ({ encounterId }) => (await runQuery(EncounterRecordDocument, { encounterId })).encounterRecord,
		),
		allergies: query<Inputs['allergies'], Outputs['allergies']>(
			path('allergies'),
			async ({ patientId }) => (await runQuery(PatientAllergiesDocument, { patientId })).patientAllergies,
		),
		searchIcd10: query<Inputs['searchIcd10'], Outputs['searchIcd10']>(
			path('searchIcd10'),
			async ({ query: text }) => (await runQuery(SearchIcd10Document, { query: text })).searchIcd10,
		),
		prescriptionPrint: query<Inputs['prescriptionPrint'], Outputs['prescriptionPrint']>(
			path('prescriptionPrint'),
			async ({ id }) => (await runQuery(PrescriptionPrintDocument, { id })).prescription,
		),
		certificatePrint: query<Inputs['certificatePrint'], Outputs['certificatePrint']>(
			path('certificatePrint'),
			async ({ id }) => (await runQuery(MedicalCertificatePrintDocument, { id })).medicalCertificate,
		),
		myPractitioner: query<Inputs['myPractitioner'], Outputs['myPractitioner']>(
			path('myPractitioner'),
			async () => (await runQuery(MyPractitionerDocument, {})).myPractitioner,
		),
		saveMyPractitioner: mutation<Inputs['saveMyPractitioner'], Outputs['saveMyPractitioner']>(
			path('saveMyPractitioner'),
			async (input) => (await runMutation(SaveMyPractitionerDocument, { input })).saveMyPractitioner,
		),
		updateNote: mutation<Inputs['updateNote'], Outputs['updateNote']>(
			path('updateNote'),
			async (input) => (await runMutation(UpdateEncounterNoteDocument, { input })).updateEncounterNote,
		),
		recordVitals: mutation<Inputs['recordVitals'], Outputs['recordVitals']>(
			path('recordVitals'),
			async (input) => (await runMutation(RecordVitalsDocument, { input })).recordVitals,
		),
		voidVitals: mutation<Inputs['voidVitals'], Outputs['voidVitals']>(
			path('voidVitals'),
			async (input) => (await runMutation(VoidVitalsDocument, { input })).voidVitals,
		),
		addDiagnosis: mutation<Inputs['addDiagnosis'], Outputs['addDiagnosis']>(
			path('addDiagnosis'),
			async (input) => (await runMutation(AddDiagnosisDocument, { input })).addDiagnosis,
		),
		updateDiagnosis: mutation<Inputs['updateDiagnosis'], Outputs['updateDiagnosis']>(
			path('updateDiagnosis'),
			async (input) => (await runMutation(UpdateDiagnosisDocument, { input })).updateDiagnosis,
		),
		voidDiagnosis: mutation<Inputs['voidDiagnosis'], Outputs['voidDiagnosis']>(
			path('voidDiagnosis'),
			async (input) => (await runMutation(VoidDiagnosisDocument, { input })).voidDiagnosis,
		),
		addAllergy: mutation<Inputs['addAllergy'], Outputs['addAllergy']>(
			path('addAllergy'),
			async (input) => (await runMutation(AddAllergyDocument, { input })).addAllergy,
		),
		voidAllergy: mutation<Inputs['voidAllergy'], Outputs['voidAllergy']>(
			path('voidAllergy'),
			async (input) => (await runMutation(VoidAllergyDocument, { input })).voidAllergy,
		),
		savePrescription: mutation<Inputs['savePrescription'], Outputs['savePrescription']>(
			path('savePrescription'),
			async (input) => (await runMutation(SavePrescriptionDocument, { input })).savePrescription,
		),
		issuePrescription: mutation<Inputs['issuePrescription'], Outputs['issuePrescription']>(
			path('issuePrescription'),
			async (variables) => (await runMutation(IssuePrescriptionDocument, variables)).issuePrescription,
		),
		voidPrescription: mutation<Inputs['voidPrescription'], Outputs['voidPrescription']>(
			path('voidPrescription'),
			async (input) => (await runMutation(VoidPrescriptionDocument, { input })).voidPrescription,
		),
		saveCertificate: mutation<Inputs['saveCertificate'], Outputs['saveCertificate']>(
			path('saveCertificate'),
			async (input) => (await runMutation(SaveMedicalCertificateDocument, { input })).saveMedicalCertificate,
		),
		issueCertificate: mutation<Inputs['issueCertificate'], Outputs['issueCertificate']>(
			path('issueCertificate'),
			async ({ id }) => (await runMutation(IssueMedicalCertificateDocument, { id })).issueMedicalCertificate,
		),
		voidCertificate: mutation<Inputs['voidCertificate'], Outputs['voidCertificate']>(
			path('voidCertificate'),
			async (input) => (await runMutation(VoidMedicalCertificateDocument, { input })).voidMedicalCertificate,
		),
	},
};
