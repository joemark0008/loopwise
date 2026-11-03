// Synthetic encounter records for the demo (DESIGN.md §7, §14): clinician profiles and letterhead addresses, and
// Maria Santos's first visit as a full record (SOAP note, vitals, ICD-10 diagnoses, an issued prescription and
// medical certificate). Jose Ramos gets a penicillin allergy and a draft prescription. Synthetic data only: the
// license and PTR numbers are made up. Idempotent: skipped once Dr. Reyes has a clinician profile.
import type { Prisma } from '../src/generated/prisma/client.js';

const DAY = 24 * 60 * 60 * 1000;

const ADDRESSES: Record<string, { address: string; phone: string }> = {
	'tagbilaran-hc': { address: 'CPG Avenue, Tagbilaran City, Bohol', phone: '(038) 000-0101' },
	'bohol-diagnostics': { address: 'Carlos P. Garcia East Avenue, Tagbilaran City, Bohol', phone: '(038) 000-0202' },
	'bohol-regional': { address: 'Miguel Parras Street, Tagbilaran City, Bohol', phone: '(038) 000-0303' },
	'botica-tagbilaran': { address: 'Gallares Street, Tagbilaran City, Bohol', phone: '(038) 000-0404' },
};

const PROFILES = [
	{
		email: 'dr.reyes@loopwise.test',
		credentials: 'MD',
		specialty: 'Family medicine',
		prc: '0000001',
		ptr: '9000001',
	},
	{
		email: 'dr.cruz@loopwise.test',
		credentials: 'MD, FPCP',
		specialty: 'Internal medicine',
		prc: '0000002',
		ptr: '9000002',
	},
] as const;

const number = (prefix: string, id: string, at: Date) =>
	`${prefix}-${at.toISOString().slice(0, 10).replaceAll('-', '')}-${id.slice(0, 6).toUpperCase()}`;

export async function seedEncounterRecords(tx: Prisma.TransactionClient): Promise<boolean> {
	const reyes = await tx.user.findUnique({
		where: { email: PROFILES[0].email },
		include: { clinicianProfile: true },
	});
	if (!reyes) {
		return false;
	}
	if (reyes.clinicianProfile) {
		return seedBill(tx);
	}

	for (const [slug, letterhead] of Object.entries(ADDRESSES)) {
		await tx.organization.updateMany({ where: { slug }, data: letterhead });
	}
	for (const profile of PROFILES) {
		const user = await tx.user.findUnique({ where: { email: profile.email } });
		if (user) {
			await tx.clinicianProfile.create({
				data: {
					userId: user.id,
					credentials: profile.credentials,
					specialty: profile.specialty,
					prcLicenseNumber: profile.prc,
					ptrNumber: profile.ptr,
				},
			});
		}
	}

	const healthCenter = await tx.organization.findUniqueOrThrow({ where: { slug: 'tagbilaran-hc' } });
	const visitOf = (givenName: string, familyName: string) =>
		tx.encounter.findFirst({
			where: { patient: { givenName, familyName }, orgId: healthCenter.id },
			orderBy: { startedAt: 'asc' },
		});

	const maria = await visitOf('Maria', 'Santos');
	if (maria) {
		const at = (hours: number) => new Date(maria.startedAt.getTime() + hours * 60 * 60 * 1000);
		const base = { encounterId: maria.id, patientId: maria.patientId, orgId: healthCenter.id };
		await tx.encounter.update({
			where: { id: maria.id },
			data: {
				history:
					'45-year-old woman with 2 weeks of fatigue, frequent urination and thirst. No chest pain, no headache. ' +
					'Mother has diabetes. Not on maintenance medicines.',
				physicalExam:
					'Alert, not in distress. BP 140/90 (repeat 138/88), HR 88 regular. Heart and lungs normal.',
				assessment: 'Stage 1 hypertension. Possible type 2 diabetes: for HbA1c and lipid profile.',
				plan: 'HbA1c and lipid panel at Bohol Diagnostics. Start amlodipine 5 mg once a day. Low-salt diet.',
				patientInstructions:
					'Take amlodipine every morning. Eat less salt and sweets. Come back with your lab results in 2 weeks.',
				followUpOn: new Date(maria.startedAt.getTime() + 14 * DAY),
			},
		});
		await tx.vitalSigns.createMany({
			data: [
				{
					...base,
					systolicMmHg: 140,
					diastolicMmHg: 90,
					heartRateBpm: 88,
					respiratoryRate: 18,
					temperatureC: 36.7,
					spo2Pct: 98,
					weightKg: 72,
					heightCm: 155,
					bmi: 30,
					bloodGlucoseMgDl: 142,
					recordedAt: at(0),
					recordedById: reyes.id,
				},
				{
					...base,
					systolicMmHg: 138,
					diastolicMmHg: 88,
					heartRateBpm: 84,
					recordedAt: at(0.5),
					recordedById: reyes.id,
				},
			],
		});
		await tx.encounterDiagnosis.createMany({
			data: [
				{
					...base,
					icd10Code: 'I10',
					display: 'Essential (primary) hypertension',
					certainty: 'provisional',
					isPrimary: true,
					rank: 0,
					recordedById: reyes.id,
				},
				{ ...base, icd10Code: 'R53', display: 'Malaise and fatigue', rank: 1, recordedById: reyes.id },
			],
		});
		const issuedAt = at(1);
		const signatory = {
			name: `${reyes.name}, MD`,
			facility: healthCenter.name,
			address: ADDRESSES['tagbilaran-hc'].address,
		};
		const rx = await tx.prescription.create({
			data: {
				...base,
				prescriberId: reyes.id,
				items: {
					create: {
						genericName: 'Amlodipine',
						strength: '5 mg',
						form: 'tablet',
						dose: '1 tablet',
						route: 'oral',
						frequency: 'once a day',
						durationDays: 30,
						quantity: 30,
						quantityUnit: 'tablets',
						instructions: 'Take every morning after breakfast.',
					},
				},
			},
		});
		await tx.prescription.update({
			where: { id: rx.id },
			data: {
				status: 'issued',
				issuedAt,
				rxNumber: number('RX', rx.id, issuedAt),
				prescriberName: signatory.name,
				prescriberLicense: PROFILES[0].prc,
				prescriberPtr: PROFILES[0].ptr,
				facilityName: signatory.facility,
				facilityAddress: signatory.address,
			},
		});
		const certificate = await tx.medicalCertificate.create({
			data: {
				...base,
				issuedById: reyes.id,
				examinedOn: maria.startedAt,
				diagnosisText: 'Essential (primary) hypertension (I10); malaise and fatigue (R53)',
				fitness: 'unfit',
				restFrom: maria.startedAt,
				restDays: 1,
				remarks: 'May return to work the following day.',
				purpose: 'work',
			},
		});
		await tx.medicalCertificate.update({
			where: { id: certificate.id },
			data: {
				status: 'issued',
				issuedAt,
				certificateNumber: number('MC', certificate.id, issuedAt),
				doctorName: signatory.name,
				doctorLicense: PROFILES[0].prc,
				doctorPtr: PROFILES[0].ptr,
				facilityName: signatory.facility,
				facilityAddress: signatory.address,
			},
		});
		await tx.auditLog.createMany({
			data: [
				{ action: 'prescription.issue', resource: 'prescription', resourceId: rx.id },
				{ action: 'medical_certificate.issue', resource: 'medical_certificate', resourceId: certificate.id },
			].map((entry) => ({
				...entry,
				userId: reyes.id,
				orgId: healthCenter.id,
				patientId: maria.patientId,
				at: issuedAt,
			})),
		});
	}

	const jose = await visitOf('Jose', 'Ramos');
	if (jose) {
		await tx.patientAllergy.create({
			data: {
				patientId: jose.patientId,
				orgId: healthCenter.id,
				substance: 'Penicillin',
				kind: 'drug',
				reaction: 'Hives',
				severity: 'moderate',
				recordedById: reyes.id,
			},
		});
		await tx.prescription.create({
			data: {
				encounterId: jose.id,
				patientId: jose.patientId,
				orgId: healthCenter.id,
				prescriberId: reyes.id,
				notes: 'Draft: check the allergy before issuing.',
				items: {
					create: {
						genericName: 'Amoxicillin',
						strength: '500 mg',
						form: 'capsule',
						dose: '1 capsule',
						frequency: 'three times a day',
						durationDays: 7,
						quantity: 21,
						quantityUnit: 'capsules',
					},
				},
			},
		});
	}
	await seedBill(tx);
	return true;
}

/** Maria's first visit gets a finalized bill (Phase 2); separate so databases seeded before billing get it too. */
async function seedBill(tx: Prisma.TransactionClient): Promise<boolean> {
	const visit = await tx.encounter.findFirst({
		where: { patient: { givenName: 'Maria', familyName: 'Santos' }, organization: { slug: 'tagbilaran-hc' } },
		orderBy: { startedAt: 'asc' },
	});
	if (!visit || (await tx.encounterBill.count({ where: { encounterId: visit.id } })) > 0) {
		return false;
	}
	const charges = [
		{ kind: 'consultation' as const, description: 'Consultation', code: 'CONSULT', unitPrice: 300 },
		{ kind: 'laboratory' as const, description: 'Capillary blood glucose', code: 'CBG', unitPrice: 80 },
	];
	const subtotal = charges.reduce((sum, charge) => sum + charge.unitPrice, 0);
	const bill = await tx.encounterBill.create({
		data: {
			encounterId: visit.id,
			patientId: visit.patientId,
			orgId: visit.orgId,
			subtotal,
			philhealthPackageCode: 'KONSULTA',
			philhealthCoverage: 300,
			total: subtotal - 300,
			charges: {
				createMany: {
					data: charges.map((charge, position) => ({
						...charge,
						position,
						quantity: 1,
						amount: charge.unitPrice,
					})),
				},
			},
		},
	});
	await tx.encounterBill.update({
		where: { id: bill.id },
		data: { status: 'finalized', finalizedAt: visit.startedAt, finalizedById: visit.doctorId },
	});
	return true;
}
