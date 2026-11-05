import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DocumentsModule } from '../src/clinical/documents/documents.module.js';
import { PrescriptionsModule } from '../src/clinical/prescriptions/prescriptions.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	CLINICAL_CORE_MODULES,
	createClinicalTestApp,
	graphql,
	resetDatabase,
	signIn,
	useTestDatabase,
} from './clinical-test-app.js';
import { type ClinicScene, createClinicScene, createPractitioner } from './fixtures/clinic-fixtures.js';

const RX_FIELDS = `id rxNo documentStatus status version verificationCode issuedAt voidedAt isDangerousDrug
	items { genericName sig quantity quantityInWords route } signatory { name licenseNumber facilityName }`;
const SAVE_RX = `mutation ($input: SavePrescriptionInput!) { savePrescription(input: $input) { ${RX_FIELDS} } }`;
const ISSUE_RX = `mutation ($id: ID!, $override: Boolean, $wiseOrigin: WiseOriginInput) {
	issuePrescription(id: $id, overrideAllergyWarning: $override, wiseOrigin: $wiseOrigin) { ${RX_FIELDS} } }`;
const VOID_RX = `mutation ($input: VoidEntryInput!) { voidPrescription(input: $input) { ${RX_FIELDS} } }`;
const CERT_FIELDS = `id certNo documentStatus isVoid issuedAt restTo isFitToWork verificationCode signatory { name }`;
const SAVE_CERT = `mutation ($input: SaveMedicalCertificateInput!) { saveMedicalCertificate(input: $input) { ${CERT_FIELDS} } }`;
const ISSUE_CERT = `mutation ($id: ID!, $wiseOrigin: WiseOriginInput) {
	issueMedicalCertificate(id: $id, wiseOrigin: $wiseOrigin) { ${CERT_FIELDS} } }`;
const VOID_CERT = `mutation ($input: VoidEntryInput!) { voidMedicalCertificate(input: $input) { ${CERT_FIELDS} } }`;
const CREATE_REFERRAL = `mutation ($input: CreateReferralInput!) { createReferral(input: $input) {
	id status urgency toPractitionerId toFacility toPractitioner { displayName } fromPractitioner { id } } }`;

const amoxicillin = {
	genericName: 'Amoxicillin',
	strength: '500 mg',
	dosageForm: 'capsule',
	dose: '1 capsule',
	frequency: 'every 8 hours',
	durationDays: 7,
	quantity: 21,
	unit: 'capsules',
};

/**
 * Prescriptions, medical certificates and referrals of an encounter: draft → issue (signed, locked) → void, the
 * allergy check (RA 6675) and dangerous drugs (RA 9165), print views audited, Wise cards confirming issue and void.
 */
describe('prescriptions and documents (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let scene: ClinicScene;
	let cookie: string[];

	const errorOf = (res: { body: { errors?: { extensions?: Record<string, unknown> }[] } }) =>
		res.body.errors?.[0]?.extensions;
	const ok = async (query: string, variables: Record<string, unknown>) => {
		const res = await graphql(app, cookie, query, variables);
		expect(res.body.errors).toBeUndefined();
		return Object.values(res.body.data as Record<string, unknown>)[0] as Record<string, never>;
	};

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createClinicalTestApp([...CLINICAL_CORE_MODULES, PrescriptionsModule, DocumentsModule]);
		prisma = app.get(PrismaService);
		scene = await createClinicScene(prisma);
		await prisma.patientAllergy.create({
			data: { patientId: scene.patient.id, type: 'DRUG', allergen: 'Penicillin', severity: 'SEVERE' },
		});
		cookie = await signIn(app, scene.doctor);
	});

	afterAll(async () => {
		await app?.close();
	});

	it('drafts, issues against the allergy warning, locks and voids a prescription', async () => {
		const draft = await ok(SAVE_RX, { input: { encounterId: scene.encounter.id, items: [amoxicillin] } });
		expect(draft).toMatchObject({
			rxNo: expect.stringMatching(/-RX-\d{4}-000001$/),
			documentStatus: 'DRAFT',
			status: 'ACTIVE',
			issuedAt: null,
			items: [{ sig: '1 capsule by mouth every 8 hours for 7 days', quantity: 21, route: 'PO' }],
		});
		expect(draft.verificationCode).toMatch(/^[A-Z2-9]{10}$/);

		const stale = await graphql(app, cookie, SAVE_RX, {
			input: { id: draft.id, encounterId: scene.encounter.id, items: [amoxicillin], expectedVersion: 0 },
		});
		expect(errorOf(stale)).toMatchObject({ errorCode: 'STALE_VERSION' });
		const edited = await ok(SAVE_RX, {
			input: {
				id: draft.id,
				encounterId: scene.encounter.id,
				items: [{ ...amoxicillin, quantity: 30 }],
				expectedVersion: draft.version,
			},
		});
		expect(edited).toMatchObject({ rxNo: draft.rxNo, items: [{ quantity: 30 }] });

		const warned = await graphql(app, cookie, ISSUE_RX, { id: draft.id });
		expect(errorOf(warned)).toMatchObject({ errorCode: 'ALLERGY_WARNING' });
		const issued = await ok(ISSUE_RX, { id: draft.id, override: true });
		expect(issued).toMatchObject({
			documentStatus: 'ISSUED',
			issuedAt: expect.any(String),
			signatory: { name: expect.stringContaining('Reyes'), licenseNumber: scene.doctorPractitioner.prcLicenseNo },
		});
		expect(
			await prisma.auditLog.findFirst({ where: { entityId: draft.id, event: 'prescription.issue' } }),
		).toMatchObject({ action: 'SIGN', reason: expect.stringContaining('Allergy warning overridden') });

		const locked = await graphql(app, cookie, SAVE_RX, {
			input: { id: draft.id, encounterId: scene.encounter.id, items: [amoxicillin] },
		});
		expect(errorOf(locked)).toMatchObject({ errorCode: 'DOCUMENT_ALREADY_ISSUED' });
		await expect(
			prisma.prescription.update({ where: { id: draft.id }, data: { notes: 'changed after issue' } }),
		).rejects.toThrow(/can only be voided/);
		await expect(
			prisma.prescriptionItem.updateMany({ where: { prescriptionId: draft.id }, data: { sig: 'x' } }),
		).rejects.toThrow(/cannot change/);

		const voided = await ok(VOID_RX, { input: { id: draft.id, reason: 'Wrong patient' } });
		expect(voided).toMatchObject({ status: 'CANCELLED', voidedAt: expect.any(String), documentStatus: 'ISSUED' });
		expect(
			errorOf(await graphql(app, cookie, VOID_RX, { input: { id: draft.id, reason: 'Again' } })),
		).toMatchObject({ errorCode: 'DOCUMENT_VOIDED' });
	});

	it('needs the quantity in words and an S2 license for a dangerous drug (RA 9165)', async () => {
		const tramadol = {
			genericName: 'Tramadol',
			strength: '50 mg',
			sig: '1 capsule every 8 hours as needed',
			quantity: 10,
		};
		const missingWords = await graphql(app, cookie, SAVE_RX, {
			input: { encounterId: scene.encounter.id, isDangerousDrug: true, items: [tramadol] },
		});
		expect(errorOf(missingWords)).toMatchObject({ errorCode: 'INVALID_PRESCRIPTION_DRAFT' });
		const draft = await ok(SAVE_RX, {
			input: {
				encounterId: scene.encounter.id,
				isDangerousDrug: true,
				items: [{ ...tramadol, quantityInWords: 'ten (10)' }],
			},
		});
		expect(errorOf(await graphql(app, cookie, ISSUE_RX, { id: draft.id }))).toMatchObject({
			errorCode: 'S2_LICENSE_REQUIRED',
		});
		await prisma.practitioner.update({
			where: { id: scene.doctorPractitioner.id },
			data: { s2LicenseNo: 'S2-0001' },
		});
		expect(await ok(ISSUE_RX, { id: draft.id })).toMatchObject({ documentStatus: 'ISSUED' });
	});

	it('drafts, issues and voids a medical certificate, and audits printing', async () => {
		const draft = await ok(SAVE_CERT, {
			input: {
				encounterId: scene.encounter.id,
				examinedOn: '2026-11-03',
				diagnosisText: 'Acute upper respiratory infection',
				isFitToWork: false,
				restFrom: '2026-11-03',
				restDays: 3,
			},
		});
		expect(draft).toMatchObject({
			certNo: expect.stringMatching(/-MC-\d{4}-000001$/),
			documentStatus: 'DRAFT',
			restTo: '2026-11-05',
			isFitToWork: false,
		});
		const unfitWithoutRest = await graphql(app, cookie, SAVE_CERT, {
			input: {
				encounterId: scene.encounter.id,
				examinedOn: '2026-11-03',
				diagnosisText: 'x',
				isFitToWork: false,
			},
		});
		expect(errorOf(unfitWithoutRest)).toMatchObject({ errorCode: 'INVALID_DOCUMENT_DRAFT' });

		const printed = await ok(`query ($id: ID!) { medicalCertificate(id: $id) { ${CERT_FIELDS} } }`, {
			id: draft.id,
		});
		expect(printed.signatory).toMatchObject({ name: expect.stringContaining('Reyes') });
		expect(
			await prisma.auditLog.findFirst({ where: { entityId: draft.id, event: 'medical_certificate.print' } }),
		).toMatchObject({ action: 'PRINT', userId: scene.doctor.id });

		const issued = await ok(ISSUE_CERT, { id: draft.id });
		expect(issued).toMatchObject({ documentStatus: 'ISSUED', issuedAt: expect.any(String) });
		await expect(
			prisma.medicalCertificate.update({ where: { id: draft.id }, data: { restDays: 5 } }),
		).rejects.toThrow(/can only be voided/);
		const voided = await ok(VOID_CERT, { input: { id: draft.id, reason: 'Issued in error' } });
		expect(voided).toMatchObject({ isVoid: true });
	});

	it('confirms issuing and voiding from Wise cards, once', async () => {
		const chat = await prisma.chat.create({
			data: {
				userId: scene.doctor.id,
				clinicId: scene.clinic.id,
				surface: 'patient',
				patientId: scene.patient.id,
			},
		});
		const card = async (toolName: string) => {
			const toolCallId = `call_${crypto.randomUUID()}`;
			await prisma.chatMessage.create({
				data: {
					chatId: chat.id,
					role: 'assistant',
					parts: {
						create: {
							order: 0,
							type: `tool-${toolName}`,
							toolCallId,
							toolName,
							toolState: 'output-available',
						},
					},
				},
			});
			return { chatId: chat.id, toolCallId, toolName, edited: false };
		};
		const draft = await ok(SAVE_RX, {
			input: {
				encounterId: scene.encounter.id,
				items: [
					{
						genericName: 'Paracetamol',
						strength: '500 mg',
						dose: '1 tablet',
						frequency: 'every 6 hours',
						isPrn: true,
						quantity: 10,
					},
				],
				wiseOrigin: await card('propose_prescription'),
			},
		});
		const issueCard = await card('propose_issue_document');
		await ok(ISSUE_RX, { id: draft.id, wiseOrigin: issueCard });
		expect(
			await prisma.wiseProposalOutcome.findUnique({ where: { toolCallId: issueCard.toolCallId } }),
		).toMatchObject({ status: 'confirmed', entityType: 'Prescription', entityId: draft.id });
		expect(
			await prisma.auditLog.findFirst({ where: { entityId: draft.id, event: 'prescription.issue' } }),
		).toMatchObject({ origin: { via: 'wise', toolName: 'propose_issue_document' } });

		const voidCard = await card('propose_void_document');
		await ok(VOID_RX, { input: { id: draft.id, reason: 'Duplicate', wiseOrigin: voidCard } });
		const twice = await graphql(app, cookie, VOID_RX, {
			input: { id: draft.id, reason: 'Duplicate', wiseOrigin: voidCard },
		});
		expect(errorOf(twice)).toMatchObject({ errorCode: 'WISE_CARD_ALREADY_SETTLED' });
	});

	it('refers internally (granting access) or outside, and needs a target', async () => {
		const target = await createPractitioner(prisma, {
			userId: scene.otherDoctor.id,
			clinicIds: [scene.clinic.id],
			specialty: 'Internal Medicine',
		});
		const otherCookie = await signIn(app, scene.otherDoctor);
		const before = await graphql(app, otherCookie, 'query ($id: ID!) { patient(id: $id) { id } }', {
			id: scene.patient.id,
		});
		expect(before.body.data.patient).toBeNull();

		const internal = await ok(CREATE_REFERRAL, {
			input: { encounterId: scene.encounter.id, toPractitionerId: target.id, reason: 'For IM evaluation' },
		});
		expect(internal).toMatchObject({ status: 'SENT', urgency: 'ROUTINE', toPractitionerId: target.id });
		const after = await graphql(app, otherCookie, 'query ($id: ID!) { patient(id: $id) { id } }', {
			id: scene.patient.id,
		});
		expect(after.body.data.patient).toEqual({ id: scene.patient.id });
		expect(
			await prisma.careRelationship.findFirst({
				where: { userId: scene.otherDoctor.id, patientId: scene.patient.id },
			}),
		).toMatchObject({ reason: 'REFERRAL' });

		const external = await ok(CREATE_REFERRAL, {
			input: {
				encounterId: scene.encounter.id,
				toFacility: 'Gov. Celestino Gallares Memorial Medical Center',
				reason: 'For CT scan',
				urgency: 'URGENT',
			},
		});
		expect(external).toMatchObject({ toPractitionerId: null, urgency: 'URGENT' });
		const noTarget = await graphql(app, cookie, CREATE_REFERRAL, {
			input: { encounterId: scene.encounter.id, reason: 'Nowhere' },
		});
		expect(errorOf(noTarget)).toMatchObject({ errorCode: 'INVALID_DOCUMENT_DRAFT' });

		const cancelled = await ok(
			'mutation ($input: CancelReferralInput!) { cancelReferral(input: $input) { status } }',
			{ input: { id: external.id, reason: 'Done here instead' } },
		);
		expect(cancelled).toEqual({ status: 'CANCELLED' });
	});

	it('shows the documents on the encounter record and the visit list', async () => {
		const record = await ok(
			`query ($id: ID!) { encounterRecord(encounterId: $id) {
				prescriptions { rxNo } medicalCertificates { certNo } referrals { reason } } }`,
			{ id: scene.encounter.id },
		);
		expect(record.prescriptions).toHaveLength(3);
		expect(record.medicalCertificates).toHaveLength(1);
		expect(record.referrals).toHaveLength(2);
		const overview = await ok(
			'query ($id: ID!) { patientOverview(patientId: $id) { visits { prescriptions { rxNo voidedAt } } } }',
			{ id: scene.patient.id },
		);
		expect(overview.visits).toEqual([{ prescriptions: [expect.objectContaining({ voidedAt: null })] }]);
	});
});
