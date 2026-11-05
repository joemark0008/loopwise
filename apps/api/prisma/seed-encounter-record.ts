// Synthetic encounter records for the demo (DESIGN.md §5): Maria Santos's first full visit as a complete record (SOAP
// note, vitals, ICD-10 diagnoses, an issued prescription and medical certificate, and her referral to the internist),
// Liza Mendoza's referral to the hospital, Jose Ramos's penicillin allergy and today's visit with a draft amoxicillin
// prescription (the allergy check catches it), and today's triage vitals. Synthetic data only: license and PTR numbers
// are made up. Runs once, on the fresh demo of `seedClinicalDemo`.
import type { Prisma } from '../src/generated/prisma/client.js';
import { dateOnly, type DemoContext, icd10, verificationCode } from './seed-clinical.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * What the print view shows above the signature as it was at issue: the prescriber's credentials and the clinic's
 * letterhead (the `signatory` column of prescriptions and medical certificates).
 */
async function signatoryOf(tx: Prisma.TransactionClient, demo: DemoContext, practitionerId: string) {
	const practitioner = await tx.practitioner.findUniqueOrThrow({ where: { id: practitionerId } });
	const clinic = await tx.clinic.findUniqueOrThrow({
		where: { id: demo.clinic.id },
		include: { barangay: true, cityMunicipality: true },
	});
	return {
		practitionerId,
		name: [practitioner.title, practitioner.firstName, practitioner.lastName].filter(Boolean).join(' '),
		credentials: practitioner.postNominals,
		specialty: practitioner.specialty,
		licenseNumber: practitioner.prcLicenseNo,
		ptrNumber: practitioner.ptrNo,
		s2LicenseNo: practitioner.s2LicenseNo,
		facilityName: clinic.name,
		facilityAddress: [clinic.addressLine, clinic.barangay?.name, clinic.cityMunicipality?.name, 'Bohol']
			.filter(Boolean)
			.join(', '),
		facilityPhone: clinic.contactNo,
	};
}

export async function seedEncounterRecords(tx: Prisma.TransactionClient, demo: DemoContext): Promise<void> {
	const { staff, practitioners, encounters } = demo;
	const reyes = staff.doctor;

	// --- Maria Santos, first full visit -------------------------------------------------------------------------
	const maria = encounters.mariaFirstVisit;
	const at = (hours: number) => new Date(maria.startedAt.getTime() + hours * 60 * MINUTE);
	await tx.encounter.update({
		where: { id: maria.id },
		data: {
			historyOfPresentIllness:
				'45-year-old woman with 2 weeks of fatigue, frequent urination and thirst. No chest pain, no headache. ' +
				'Mother has diabetes. Not on maintenance medicines.',
			physicalExam: 'Alert, not in distress. BP 140/90 (repeat 138/88), HR 88 regular. Heart and lungs normal.',
			assessment: 'Stage 1 hypertension. Possible type 2 diabetes: for HbA1c and lipid profile.',
			plan: 'HbA1c and lipid panel. Start amlodipine 5 mg once a day. Low-salt diet. Refer to internal medicine.',
			patientInstructions:
				'Take amlodipine every morning. Eat less salt and sweets. Come back with your lab results in 2 weeks.',
		},
	});
	await tx.vitalSigns.createMany({
		data: [
			{
				encounterId: maria.id,
				systolicBp: 140,
				diastolicBp: 90,
				heartRate: 88,
				respiratoryRate: 18,
				temperatureC: 36.7,
				oxygenSaturation: 98,
				weightKg: 72,
				heightCm: 155,
				bmi: 30,
				bloodGlucose: 142,
				recordedAt: at(0),
				recordedById: staff.nurse,
			},
			{
				encounterId: maria.id,
				systolicBp: 138,
				diastolicBp: 88,
				heartRate: 84,
				recordedAt: at(0.5),
				recordedById: reyes,
			},
		],
	});
	await tx.encounterDiagnosis.createMany({
		data: [
			{
				encounterId: maria.id,
				...icd10('I10'),
				type: 'PRIMARY',
				isFinal: false,
				sortOrder: 0,
				recordedById: reyes,
				recordedAt: at(0.75),
			},
			{
				encounterId: maria.id,
				...icd10('R53'),
				type: 'SECONDARY',
				isFinal: true,
				sortOrder: 1,
				recordedById: reyes,
				recordedAt: at(0.75),
			},
		],
	});

	const issuedAt = at(1);
	const signatory = await signatoryOf(tx, demo, practitioners.doctor);
	// Drafted, then issued: the lines of an issued prescription are locked (trigger `prescription_items_lock`).
	const rx = await tx.prescription.create({
		data: {
			rxNo: await demo.nextNumber('RX', issuedAt),
			encounterId: maria.id,
			practitionerId: practitioners.doctor,
			verificationCode: verificationCode(),
			issuedAt,
			validUntil: dateOnly(new Date(issuedAt.getTime() + 30 * DAY)),
			notes: 'Low-salt diet.',
			createdAt: issuedAt,
			items: {
				create: {
					genericName: 'Amlodipine',
					brandName: null,
					strength: '5 mg',
					dosageForm: 'tablet',
					quantity: 30,
					unit: 'tablets',
					sig: '1 tablet by mouth once a day for 30 days. Take every morning after breakfast.',
					route: 'oral',
					frequency: 'once a day',
					durationDays: 30,
				},
			},
		},
	});
	await tx.prescription.update({ where: { id: rx.id }, data: { documentStatus: 'ISSUED', signatory } });

	const certificate = await tx.medicalCertificate.create({
		data: {
			certNo: await demo.nextNumber('MED_CERT', issuedAt),
			encounterId: maria.id,
			practitionerId: practitioners.doctor,
			type: 'MEDICAL_CERTIFICATE',
			purpose: 'For work absence',
			examinedAt: maria.startedAt,
			diagnosisText: 'Essential (primary) hypertension (I10); malaise and fatigue (R53)',
			recommendation: 'Rest for 1 day. May return to work the following day.',
			restDays: 1,
			restFrom: dateOnly(maria.startedAt),
			restTo: dateOnly(maria.startedAt),
			isFitToWork: false,
			issuedAt,
			verificationCode: verificationCode(),
			createdAt: issuedAt,
		},
	});
	await tx.medicalCertificate.update({
		where: { id: certificate.id },
		data: { documentStatus: 'ISSUED', signatory },
	});

	// Referred to the internist here, who accepted.
	const referral = await tx.referral.create({
		data: {
			encounterId: maria.id,
			fromPractitionerId: practitioners.doctor,
			toPractitionerId: practitioners.internist,
			specialty: 'Internal Medicine',
			reason: 'HbA1c 7.2%, repeat FBS 131 mg/dL: diabetes range, with stage 1 hypertension. Please evaluate and start treatment.',
			clinicalSummary: 'Fatigue, polyuria and thirst for 2 weeks. BP 140/90. Mother has diabetes.',
			urgency: 'ROUTINE',
			status: 'ACCEPTED',
			referredAt: daysAgoFrom(maria.startedAt, -3),
			responseNotes: 'Accepted. Seen at the internal medicine clinic in 3 days.',
			respondedAt: daysAgoFrom(new Date(), 3),
		},
	});

	const base = {
		userId: reyes,
		organizationId: demo.organizationId,
		clinicId: demo.clinic.id,
		patientId: maria.patientId,
		origin: { via: 'seed' },
	};
	await tx.auditLog.createMany({
		data: [
			{
				...base,
				action: 'SIGN',
				event: 'prescription.issue',
				entityType: 'Prescription',
				entityId: rx.id,
				createdAt: issuedAt,
			},
			{
				...base,
				action: 'SIGN',
				event: 'medical_certificate.issue',
				entityType: 'MedicalCertificate',
				entityId: certificate.id,
				createdAt: issuedAt,
			},
			{
				...base,
				action: 'CREATE',
				event: 'referral.create',
				entityType: 'Referral',
				entityId: referral.id,
				createdAt: referral.referredAt,
			},
		],
	});

	// --- Liza Mendoza: referred to the hospital for a breast assessment ------------------------------------------
	const liza = encounters.lizaVisit;
	await tx.encounter.update({
		where: { id: liza.id },
		data: {
			assessment: 'Screening mammogram BI-RADS 4: suspicious finding, for tissue diagnosis.',
			plan: 'Refer to Bohol Regional Hospital surgery for assessment and biopsy.',
		},
	});
	await tx.encounterDiagnosis.create({
		data: { encounterId: liza.id, ...icd10('R92'), type: 'PRIMARY', sortOrder: 0, recordedById: reyes },
	});
	await tx.referral.create({
		data: {
			encounterId: liza.id,
			fromPractitionerId: practitioners.doctor,
			toFacility: 'Bohol Regional Hospital',
			specialty: 'Surgery (breast)',
			reason: 'Screening mammogram BI-RADS 4: please assess for biopsy.',
			urgency: 'URGENT',
			status: 'SENT',
			referredAt: daysAgoFrom(new Date(), 4),
		},
	});

	// --- The other past visits: a working diagnosis each ------------------------------------------------------------
	for (const [key, code, secondary] of [
		['joseCheckup', 'Z00.0', null],
		['anaVisit', 'Z13.1', null],
		['carmenVisit', 'Z00.0', null],
		['pedroVisit', 'R63.4', 'R63.1'],
		['ramonVisit', 'I10', null],
	] as const) {
		const visit = encounters[key];
		await tx.encounterDiagnosis.create({
			data: { encounterId: visit.id, ...icd10(code), type: 'PRIMARY', sortOrder: 0, recordedById: reyes },
		});
		if (secondary) {
			await tx.encounterDiagnosis.create({
				data: {
					encounterId: visit.id,
					...icd10(secondary),
					type: 'SECONDARY',
					sortOrder: 1,
					recordedById: reyes,
				},
			});
		}
	}

	// --- Jose Ramos: penicillin allergy, and today's visit with a draft amoxicillin prescription -------------------
	const joseToday = encounters.joseToday;
	await tx.patientAllergy.create({
		data: {
			patientId: joseToday.patientId,
			type: 'DRUG',
			allergen: 'Penicillin',
			reaction: 'Hives',
			severity: 'MODERATE',
			notedAt: encounters.joseCheckup.startedAt,
		},
	});
	await tx.encounter.update({
		where: { id: joseToday.id },
		data: {
			historyOfPresentIllness: 'Sore throat and fever up to 38.5 °C for 3 days. Painful swallowing. No cough.',
			physicalExam: 'Enlarged, red tonsils with exudates. Tender anterior cervical nodes. Lungs clear.',
			assessment: 'Acute tonsillitis, likely bacterial.',
		},
	});
	await tx.vitalSigns.create({
		data: {
			encounterId: joseToday.id,
			systolicBp: 122,
			diastolicBp: 78,
			heartRate: 96,
			respiratoryRate: 18,
			temperatureC: 38.4,
			oxygenSaturation: 98,
			recordedAt: new Date(joseToday.startedAt.getTime() + 5 * MINUTE),
			recordedById: staff.nurse,
		},
	});
	await tx.encounterDiagnosis.create({
		data: {
			encounterId: joseToday.id,
			...icd10('J03.9'),
			type: 'PRIMARY',
			isFinal: false,
			sortOrder: 0,
			recordedById: reyes,
		},
	});
	await tx.prescription.create({
		data: {
			rxNo: await demo.nextNumber('RX'),
			encounterId: joseToday.id,
			practitionerId: practitioners.doctor,
			verificationCode: verificationCode(),
			notes: 'Draft: check the allergy before issuing.',
			items: {
				create: {
					genericName: 'Amoxicillin',
					strength: '500 mg',
					dosageForm: 'capsule',
					quantity: 21,
					unit: 'capsules',
					sig: '1 capsule by mouth three times a day for 7 days.',
					route: 'oral',
					frequency: 'three times a day',
					durationDays: 7,
				},
			},
		},
	});

	// --- Ramon Gonzaga: back today, vitals taken at triage, waiting for the doctor ------------------------------------
	const ramonToday = encounters.ramonToday;
	await tx.vitalSigns.create({
		data: {
			encounterId: ramonToday.id,
			systolicBp: 156,
			diastolicBp: 98,
			heartRate: 82,
			weightKg: 90,
			heightCm: 170,
			bmi: 31.1,
			recordedAt: new Date(ramonToday.startedAt.getTime() + 5 * MINUTE),
			recordedById: staff.nurse,
		},
	});
}

/** `days` before `from` (negative: after). */
function daysAgoFrom(from: Date, days: number): Date {
	return new Date(from.getTime() - days * DAY);
}
