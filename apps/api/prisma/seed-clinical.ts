import type { CaseState, Prisma } from '../src/generated/prisma/client.js';

/**
 * Synthetic demo data for Loopwise (DESIGN.md §14): the Bohol facilities, their staff, synthetic patients, and cases
 * at different steps of the loop on the pathways of `seed-pathways.ts`. Everything here is invented; never put real
 * patient data in a seed.
 */

export const DEMO_PASSWORD = 'test1234';

export const FACILITIES = {
	healthCenter: { slug: 'tagbilaran-hc', name: 'Tagbilaran City Health Center', type: 'clinic' },
	lab: { slug: 'bohol-diagnostics', name: 'Bohol Diagnostics Laboratory', type: 'lab' },
	hospital: { slug: 'bohol-regional', name: 'Bohol Regional Hospital (with radiology)', type: 'hospital' },
	pharmacy: { slug: 'botica-tagbilaran', name: 'Botica Tagbilaran', type: 'pharmacy' },
	program: { slug: 'bohol-pho', name: 'Bohol Provincial Health Office', type: 'program' },
} as const;

type FacilityKey = keyof typeof FACILITIES;

/** Demo staff; all share `DEMO_PASSWORD`. */
export const STAFF = [
	{ key: 'doctor', name: 'Dr. Ana Reyes', email: 'dr.reyes@loopwise.test', facility: 'healthCenter' },
	{ key: 'nurse', name: 'Nurse Joy Santos', email: 'nurse.santos@loopwise.test', facility: 'healthCenter' },
	{ key: 'labTech', name: 'Mark Bautista (Lab)', email: 'lab.bautista@loopwise.test', facility: 'lab' },
	{
		key: 'specialist',
		name: 'Dr. Paolo Cruz (Internal Medicine)',
		email: 'dr.cruz@loopwise.test',
		facility: 'hospital',
	},
	{ key: 'pharmacist', name: 'Lea Garcia (Pharmacy)', email: 'pharm.garcia@loopwise.test', facility: 'pharmacy' },
	{ key: 'programManager', name: 'Program Manager', email: 'program@loopwise.test', facility: 'program' },
] as const satisfies readonly { key: string; name: string; email: string; facility: FacilityKey }[];

type StaffKey = (typeof STAFF)[number]['key'];

const LOINC = {
	hba1c: { code: '4548-4', display: 'Hemoglobin A1c', unit: '%', refRange: '4.0-5.6' },
	fbs: { code: '1558-6', display: 'Fasting glucose', unit: 'mg/dL', refRange: '70-99' },
	lipids: { code: '57698-3', display: 'Lipid panel' },
	mammogram: { code: '24606-6', display: 'MG Breast Screening' },
} as const;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);

type Ids = { orgs: Record<FacilityKey, string>; staff: Record<StaffKey, string>; adminUserId: string };

/**
 * Creates the demo facilities, memberships and clinical records. Runs as system work (the seed's own connection) in
 * the caller's transaction. Staff users are created by the caller through `createUser`, which hashes the password.
 * Returns false when the demo data is already there.
 */
export async function seedClinicalDemo(
	tx: Prisma.TransactionClient,
	opts: {
		adminUserId: string;
		adminOrgId: string;
		clinicId: string;
		createUser: (user: { name: string; email: string }) => Promise<string>;
	},
): Promise<boolean> {
	if (await tx.organization.findUnique({ where: { slug: FACILITIES.healthCenter.slug } })) {
		return false;
	}

	const orgs = {} as Record<FacilityKey, string>;
	for (const [key, facility] of Object.entries(FACILITIES) as [FacilityKey, (typeof FACILITIES)[FacilityKey]][]) {
		orgs[key] = (await tx.organization.create({ data: facility })).id;
	}

	const staff = {} as Record<StaffKey, string>;
	for (const person of STAFF) {
		const existing = await tx.user.findUnique({ where: { email: person.email } });
		const userId = existing?.id ?? (await opts.createUser({ name: person.name, email: person.email }));
		staff[person.key] = userId;
		await tx.orgMember.createMany({
			data: [
				{ orgId: orgs[person.facility], userId, role: 'user' },
				{ orgId: opts.adminOrgId, userId, role: 'user' },
			],
			skipDuplicates: true,
		});
		await tx.clinicMember.createMany({
			data: [{ clinicId: opts.clinicId, userId, role: 'user' }],
			skipDuplicates: true,
		});
	}
	// The seed admin works at the health center too, so the demo data is visible when logged in as test@test.test.
	await tx.orgMember.createMany({
		data: [{ orgId: orgs.healthCenter, userId: opts.adminUserId, role: 'admin' }],
		skipDuplicates: true,
	});

	// Seeded before the demo by `seedPathways` (seed-pathways.ts).
	const pathways = Object.fromEntries(
		(await tx.pathway.findMany({ select: { id: true, key: true } })).map(({ id, key }) => [key, id]),
	);

	await seedPatients(tx, { orgs, staff, adminUserId: opts.adminUserId }, pathways);
	return true;
}

async function seedPatients(tx: Prisma.TransactionClient, ids: Ids, pathways: Record<string, string>) {
	const { orgs, staff } = ids;
	let mrn = 0;

	const patient = async (
		givenName: string,
		familyName: string,
		birthDate: string,
		sex: 'female' | 'male',
		preferredLanguage: string,
	) => {
		mrn += 1;
		const number = String(mrn).padStart(4, '0');
		const created = await tx.patient.create({
			data: {
				givenName,
				familyName,
				birthDate: new Date(birthDate),
				sex,
				phone: `+63 900 000 ${number}`,
				preferredLanguage,
				consentAt: daysAgo(30),
				identifiers: {
					create: [
						{ orgId: orgs.healthCenter, system: 'MRN', value: `THC-${number}` },
						{ orgId: orgs.healthCenter, system: 'PhilHealth', value: `SYN-0000-${number}` },
					],
				},
				careRelationships: {
					create: [
						{ userId: staff.doctor, orgId: orgs.healthCenter, reason: 'encounter' },
						{ userId: ids.adminUserId, orgId: orgs.healthCenter, reason: 'encounter' },
					],
				},
			},
		});
		return created.id;
	};

	const encounter = (patientId: string, reason: string, startedAt: Date) =>
		tx.encounter.create({
			data: { patientId, doctorId: staff.doctor, orgId: orgs.healthCenter, reason, startedAt },
		});

	const order = async (
		patientId: string,
		encounterId: string,
		test: { code: string; display: string },
		targetOrgId: string,
		status: 'sent' | 'collected' | 'resulted' | 'reviewed',
		sentAt: Date,
	) =>
		(
			await tx.clinicalOrder.create({
				data: {
					encounterId,
					patientId,
					orderingDoctorId: staff.doctor,
					orderingOrgId: orgs.healthCenter,
					targetOrgId,
					code: test.code,
					display: test.display,
					status,
					sentAt,
				},
			})
		).id;

	const result = async (
		orderId: string,
		patientId: string,
		sourceOrgId: string,
		test: { code: string; display: string; unit?: string; refRange?: string },
		value: string,
		flag: 'normal' | 'high' | 'abnormal' | 'critical_high',
		resultedAt: Date,
		reviewed: boolean,
	) =>
		(
			await tx.result.create({
				data: {
					orderId,
					patientId,
					sourceOrgId,
					code: test.code,
					display: test.display,
					value,
					valueNumeric: Number.isFinite(Number(value)) ? Number(value) : null,
					unit: test.unit,
					refRange: test.refRange,
					flag,
					resultedAt,
					reviewedAt: reviewed ? new Date(resultedAt.getTime() + DAY / 2) : null,
					reviewedById: reviewed ? staff.doctor : null,
				},
			})
		).id;

	/** A case with its history: one event per state it went through, a day apart, ending at `states`' last entry. */
	const careCase = async (opts: {
		patientId: string;
		pathway: 'diabetes' | 'breast';
		triggerResultId: string;
		states: CaseState[];
		urgency: 'routine' | 'soon' | 'urgent' | 'critical';
		ownerUserId: string | null;
		openedAt: Date;
		dueInDays?: number;
		stateBeforeEscalation?: CaseState;
	}) => {
		const state = opts.states[opts.states.length - 1];
		const created = await tx.careCase.create({
			data: {
				patientId: opts.patientId,
				pathwayId: pathways[opts.pathway],
				triggerResultId: opts.triggerResultId,
				state,
				stateBeforeEscalation: opts.stateBeforeEscalation,
				urgency: opts.urgency,
				ownerUserId: opts.ownerUserId,
				ownerOrgId: orgs.healthCenter,
				dueAt: opts.dueInDays === undefined ? null : daysFromNow(opts.dueInDays),
				closedAt: state === 'closed' ? new Date() : null,
				createdAt: opts.openedAt,
			},
		});
		await tx.caseEvent.createMany({
			data: opts.states.map((toState, index) => ({
				caseId: created.id,
				type: index === 0 ? 'case.opened' : `case.${toState}`,
				fromState: index === 0 ? null : opts.states[index - 1],
				toState,
				actorType: index === 0 || toState === 'escalated' ? ('system' as const) : ('user' as const),
				actorUserId: index === 0 || toState === 'escalated' ? null : staff.nurse,
				createdAt: new Date(opts.openedAt.getTime() + index * DAY),
			})),
		});
		return created.id;
	};

	// Maria Santos — the happy path (§4.1): diabetes range, referred to the internist, who accepted.
	{
		const id = await patient('Maria', 'Santos', '1981-04-12', 'female', 'ceb');
		const visit = await encounter(id, 'Fatigue, frequent urination, BP 140/90', daysAgo(12));
		const orderId = await order(id, visit.id, LOINC.hba1c, orgs.lab, 'reviewed', daysAgo(12));
		await order(id, visit.id, LOINC.lipids, orgs.lab, 'reviewed', daysAgo(12));
		const resultId = await result(orderId, id, orgs.lab, LOINC.hba1c, '7.2', 'high', daysAgo(10), true);
		const caseId = await careCase({
			patientId: id,
			pathway: 'diabetes',
			triggerResultId: resultId,
			states: ['open', 'notified', 'acknowledged', 'confirming', 'referred', 'accepted'],
			urgency: 'soon',
			ownerUserId: staff.doctor,
			openedAt: daysAgo(9),
			dueInDays: 5,
		});
		await tx.referral.create({
			data: {
				caseId,
				fromOrgId: orgs.healthCenter,
				toOrgId: orgs.hospital,
				toUserId: staff.specialist,
				status: 'accepted',
				reason: 'HbA1c 7.2%, repeat FBS 131 mg/dL: confirmed diabetes range. Please evaluate and start treatment.',
				appointmentAt: daysFromNow(3),
				respondedAt: daysAgo(3),
			},
		});
		await tx.patientMessage.create({
			data: {
				caseId,
				patientId: id,
				channel: 'sms',
				templateKey: 'results.discuss_invite',
				language: 'ceb',
				body: 'Maayong adlaw! Palihug bisitaha ang Tagbilaran City Health Center aron hisgutan ang imong mga resulta.',
				status: 'acknowledged',
				sentAt: daysAgo(8),
				ackAt: daysAgo(8),
				createdById: staff.nurse,
			},
		});
		await tx.task.create({
			data: {
				caseId,
				title: 'Confirm Maria attends her internal medicine appointment',
				ownerUserId: staff.nurse,
				ownerOrgId: orgs.healthCenter,
				dueAt: daysFromNow(4),
			},
		});
	}

	// Jose Ramos — normal result, short loop: reviewed, notified, closed with a sign-off.
	{
		const id = await patient('Jose', 'Ramos', '1966-09-03', 'male', 'fil');
		const visit = await encounter(id, 'Annual check-up', daysAgo(20));
		const orderId = await order(id, visit.id, LOINC.hba1c, orgs.lab, 'reviewed', daysAgo(20));
		const resultId = await result(orderId, id, orgs.lab, LOINC.hba1c, '5.4', 'normal', daysAgo(18), true);
		const caseId = await careCase({
			patientId: id,
			pathway: 'diabetes',
			triggerResultId: resultId,
			states: ['open', 'notified', 'closed'],
			urgency: 'routine',
			ownerUserId: staff.doctor,
			openedAt: daysAgo(17),
		});
		await tx.careCase.update({ where: { id: caseId }, data: { closeReason: 'Normal result, patient informed' } });
		await tx.evidence.create({
			data: {
				caseId,
				type: 'signoff',
				note: 'Normal HbA1c; reassuring SMS sent.',
				recordedById: staff.doctor,
				recordedByOrgId: orgs.healthCenter,
			},
		});
	}

	// Liza Mendoza — abnormal mammogram (BI-RADS 4), referred to the hospital, waiting for an answer.
	{
		const id = await patient('Liza', 'Mendoza', '1973-02-21', 'female', 'en');
		const visit = await encounter(id, 'Breast screening', daysAgo(8));
		const orderId = await order(id, visit.id, LOINC.mammogram, orgs.hospital, 'reviewed', daysAgo(8));
		const resultId = await result(
			orderId,
			id,
			orgs.hospital,
			LOINC.mammogram,
			'BI-RADS 4',
			'abnormal',
			daysAgo(5),
			true,
		);
		const caseId = await careCase({
			patientId: id,
			pathway: 'breast',
			triggerResultId: resultId,
			states: ['open', 'notified', 'acknowledged', 'referred'],
			urgency: 'urgent',
			ownerUserId: staff.doctor,
			openedAt: daysAgo(4),
			dueInDays: 1,
		});
		await tx.referral.create({
			data: {
				caseId,
				fromOrgId: orgs.healthCenter,
				toOrgId: orgs.hospital,
				status: 'sent',
				reason: 'Screening mammogram BI-RADS 4: please assess for biopsy.',
			},
		});
	}

	// Pedro Villanueva — critical HbA1c: escalated straight to a clinician, nobody assigned yet.
	{
		const id = await patient('Pedro', 'Villanueva', '1963-11-30', 'male', 'ceb');
		const visit = await encounter(id, 'Weight loss, thirst', daysAgo(3));
		const orderId = await order(id, visit.id, LOINC.hba1c, orgs.lab, 'resulted', daysAgo(3));
		const resultId = await result(orderId, id, orgs.lab, LOINC.hba1c, '12.1', 'critical_high', daysAgo(1), false);
		await careCase({
			patientId: id,
			pathway: 'diabetes',
			triggerResultId: resultId,
			states: ['open', 'escalated'],
			urgency: 'critical',
			ownerUserId: null,
			openedAt: daysAgo(1),
			dueInDays: 0,
			stateBeforeEscalation: 'open',
		});
	}

	// Ana Lopez — ordered but not done: the order went out 9 days ago and was never collected.
	{
		const id = await patient('Ana', 'Lopez', '1978-06-15', 'female', 'fil');
		const visit = await encounter(id, 'Follow-up, family history of diabetes', daysAgo(9));
		await order(id, visit.id, LOINC.fbs, orgs.lab, 'sent', daysAgo(9));
	}

	// Carmen Torres — done but not reviewed: a borderline result waiting in the doctor's inbox for 3 days.
	{
		const id = await patient('Carmen', 'Torres', '1975-12-01', 'female', 'en');
		const visit = await encounter(id, 'Routine screening', daysAgo(6));
		const orderId = await order(id, visit.id, LOINC.hba1c, orgs.lab, 'resulted', daysAgo(6));
		await result(orderId, id, orgs.lab, LOINC.hba1c, '6.1', 'high', daysAgo(3), false);
	}

	// Ramon Gonzaga — lost to follow-up: SMS, nurse call and home visit all failed; still visible and counted.
	{
		const id = await patient('Ramon', 'Gonzaga', '1959-03-08', 'male', 'ceb');
		const visit = await encounter(id, 'Hypertension follow-up', daysAgo(40));
		const orderId = await order(id, visit.id, LOINC.hba1c, orgs.lab, 'reviewed', daysAgo(40));
		const resultId = await result(orderId, id, orgs.lab, LOINC.hba1c, '8.4', 'high', daysAgo(38), true);
		const caseId = await careCase({
			patientId: id,
			pathway: 'diabetes',
			triggerResultId: resultId,
			states: ['open', 'notified', 'lost_to_follow_up'],
			urgency: 'soon',
			ownerUserId: staff.nurse,
			openedAt: daysAgo(37),
		});
		await tx.patientMessage.createMany({
			data: [
				{ channel: 'sms' as const, status: 'delivered' as const },
				{ channel: 'phone_call' as const, status: 'failed' as const },
				{ channel: 'home_visit' as const, status: 'failed' as const },
			].map((attempt, index) => ({
				caseId,
				patientId: id,
				channel: attempt.channel,
				templateKey: 'results.discuss_invite',
				language: 'ceb',
				body: 'Palihug bisitaha ang health center aron hisgutan ang imong mga resulta.',
				status: attempt.status,
				sentAt: daysAgo(36 - index * 7),
				createdById: staff.nurse,
			})),
		});
	}
}
