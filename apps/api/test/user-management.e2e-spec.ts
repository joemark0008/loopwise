import type { NestExpressApplication } from '@nestjs/platform-express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const ORIGIN = 'http://localhost:3000';
const ADMIN = { name: 'Admin', email: 'admin@example.com', password: 'Adm1n-secret!' };

const CREATE_USER = `mutation Create($input: CreateUserInput!) {
	createUser(input: $input) { url expiresAt user { id email role status } }
}`;
const CREATE_LINK = `mutation Link($userId: ID!) { createPasswordLink(userId: $userId) { url expiresAt user { status } } }`;
const LINK_INFO = `query Info($token: String!) { passwordLink(token: $token) { name email isInvite } }`;
const SET_PASSWORD = `mutation Set($input: SetPasswordWithLinkInput!) { setPasswordWithLink(input: $input) }`;
const USERS = `{ managedUsers { id email role status } }`;

describe('user management (e2e)', () => {
	let app: NestExpressApplication;
	let databaseUrl: string;
	let adminCookie: string[];
	let adminId: string;

	beforeAll(async () => {
		databaseUrl = useTestDatabase();
		app = await createTestApp();
	});

	beforeEach(async () => {
		await resetDatabase(databaseUrl);
		({ cookie: adminCookie, userId: adminId } = await createTestUser(app, ADMIN));
	});

	afterAll(async () => {
		await app?.close();
	});

	const gql = (query: string, variables: Record<string, unknown> = {}, cookie: string[] = []) =>
		request(app.getHttpServer()).post('/graphql').set('Cookie', cookie).send({ query, variables });

	const signIn = (email: string, password: string) =>
		request(app.getHttpServer()).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password });

	const cookieOf = (res: request.Response) => [res.headers['set-cookie']].flat().filter(Boolean) as string[];

	const tokenOf = (url: string) => new URL(url).searchParams.get('token')!;

	const sql = async (text: string, values: unknown[] = []) => {
		const client = new pg.Client({ connectionString: databaseUrl });
		await client.connect();
		try {
			return (await client.query(text, values)).rows;
		} finally {
			await client.end();
		}
	};

	/** Creates a user through the admin API and lets them set their password. */
	const onboard = async (email: string, role = 'user', password = 'Us3r-secret!') => {
		const created = await gql(CREATE_USER, { input: { name: 'Member', email, role } }, adminCookie);
		const { url, user } = created.body.data.createUser;
		await gql(SET_PASSWORD, { input: { token: tokenOf(url), password } });
		const res = await signIn(email, password).expect(200);
		return { userId: user.id as string, cookie: cookieOf(res) };
	};

	it('creates an invited user who sets their password through the link', async () => {
		const created = await gql(
			CREATE_USER,
			{ input: { name: 'Grace', email: ' Grace@Example.com', role: 'user' } },
			adminCookie,
		);
		expect(created.body.errors).toBeUndefined();
		const { url, expiresAt, user } = created.body.data.createUser;
		expect(user).toMatchObject({ email: 'grace@example.com', role: 'user', status: 'INVITED' });
		expect(url).toMatch(/^http:\/\/localhost:3000\/set-password\?token=/);
		expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);

		const token = tokenOf(url);
		const stored = await sql('SELECT identifier FROM verifications');
		expect(stored).toHaveLength(1);
		expect(stored[0].identifier).not.toContain(token);

		const info = await gql(LINK_INFO, { token });
		expect(info.body.data.passwordLink).toEqual({ name: 'Grace', email: 'grace@example.com', isInvite: true });

		const set = await gql(SET_PASSWORD, { input: { token, password: 'Gr4ce-secret!' } });
		expect(set.body.data.setPasswordWithLink).toBe('grace@example.com');
		await signIn('grace@example.com', 'Gr4ce-secret!').expect(200);

		const reused = await gql(SET_PASSWORD, { input: { token, password: 'Another-pass1' } });
		expect(reused.body.errors[0].extensions.code).toBe('NOT_FOUND');
		expect((await gql(LINK_INFO, { token })).body.data.passwordLink).toBeNull();

		const list = await gql(USERS, {}, adminCookie);
		expect(list.body.data.managedUsers).toEqual(
			expect.arrayContaining([expect.objectContaining({ email: 'grace@example.com', status: 'ACTIVE' })]),
		);
	});

	it('refuses an email that is already taken', async () => {
		const res = await gql(CREATE_USER, { input: { name: 'Again', email: ADMIN.email, role: 'user' } }, adminCookie);
		expect(res.body.errors[0].extensions.code).toBe('CONFLICT');
	});

	it('refuses a password that is too short', async () => {
		const created = await gql(
			CREATE_USER,
			{ input: { name: 'B', email: 'b@example.com', role: 'user' } },
			adminCookie,
		);
		const res = await gql(SET_PASSWORD, {
			input: { token: tokenOf(created.body.data.createUser.url), password: 'short' },
		});
		expect(res.body.errors).toBeDefined();
		expect(await sql('SELECT id FROM accounts WHERE password IS NOT NULL')).toHaveLength(1);
	});

	it('refuses an expired link', async () => {
		const created = await gql(
			CREATE_USER,
			{ input: { name: 'E', email: 'e@example.com', role: 'user' } },
			adminCookie,
		);
		await sql("UPDATE verifications SET expires_at = now() - interval '1 minute'");
		const token = tokenOf(created.body.data.createUser.url);
		expect((await gql(LINK_INFO, { token })).body.data.passwordLink).toBeNull();
		const res = await gql(SET_PASSWORD, { input: { token, password: 'Valid-pass1' } });
		expect(res.body.errors[0].extensions.code).toBe('NOT_FOUND');
	});

	it('keeps user management to organization admins', async () => {
		const { cookie } = await onboard('member@example.com');
		for (const query of [USERS, CREATE_USER]) {
			const res = await gql(query, { input: { name: 'X', email: 'x@example.com', role: 'admin' } }, cookie);
			expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
		}
		expect((await gql('{ currentOrgRole }', {}, cookie)).body.data.currentOrgRole).toBe('user');
		expect((await gql('{ currentOrgRole }', {}, adminCookie)).body.data.currentOrgRole).toBe('admin');
	});

	it('resets a password: the old one works until the link is used, then every session ends', async () => {
		const { userId, cookie } = await onboard('reset@example.com');

		const first = await gql(CREATE_LINK, { userId }, adminCookie);
		expect(new Date(first.body.data.createPasswordLink.expiresAt).getTime()).toBeLessThan(
			Date.now() + 25 * 3600 * 1000,
		);
		const second = await gql(CREATE_LINK, { userId }, adminCookie);
		await signIn('reset@example.com', 'Us3r-secret!').expect(200);

		const stale = tokenOf(first.body.data.createPasswordLink.url);
		expect((await gql(LINK_INFO, { token: stale })).body.data.passwordLink).toBeNull();

		const token = tokenOf(second.body.data.createPasswordLink.url);
		expect((await gql(LINK_INFO, { token })).body.data.passwordLink.isInvite).toBe(false);
		await gql(SET_PASSWORD, { input: { token, password: 'N3w-secret!' } });

		await signIn('reset@example.com', 'Us3r-secret!').expect(401);
		await signIn('reset@example.com', 'N3w-secret!').expect(200);
		expect((await gql('{ me { id } }', {}, cookie)).body.errors[0].extensions.code).toBe('UNAUTHORIZED');
	});

	it('changes roles, but not your own', async () => {
		const { userId } = await onboard('role@example.com');
		const update = `mutation R($input: UpdateUserRoleInput!) { updateUserRole(input: $input) { role } }`;

		const res = await gql(update, { input: { userId, role: 'viewer' } }, adminCookie);
		expect(res.body.data.updateUserRole.role).toBe('viewer');

		const self = await gql(update, { input: { userId: adminId, role: 'user' } }, adminCookie);
		expect(self.body.errors[0].extensions.code).toBe('BAD_REQUEST');

		const invalid = await gql(update, { input: { userId, role: 'owner' } }, adminCookie);
		expect(invalid.body.errors).toBeDefined();
	});

	it("sets a user's roles at the selected clinic, which their current clinic reports", async () => {
		const atClinic =
			(cookie: string[], clinicId: string) =>
			(query: string, variables: Record<string, unknown> = {}) =>
				request(app.getHttpServer())
					.post('/graphql')
					.set('Cookie', cookie)
					.set('x-loopwise-clinic-id', clinicId)
					.send({ query, variables });
		const clinic = await gql(
			'mutation { createClinic(input: { name: "Health Center" }) { id code } }',
			{},
			adminCookie,
		);
		expect(clinic.body.errors).toBeUndefined();
		const { id: clinicId, code } = clinic.body.data.createClinic;
		expect(code).toBe('HC');
		const asAdmin = atClinic(adminCookie, clinicId);

		const created = await asAdmin(
			`mutation Create($input: CreateUserInput!) { createUser(input: $input) { url user { id role staffRoles } } }`,
			{ input: { name: 'Nina', email: 'nina@example.com', role: 'user', staffRoles: ['NURSE'] } },
		);
		expect(created.body.errors).toBeUndefined();
		const { user, url } = created.body.data.createUser;
		expect(user).toMatchObject({ role: 'user', staffRoles: ['NURSE'] });

		const set = `mutation S($input: SetUserStaffRolesInput!) { setUserStaffRoles(input: $input) { staffRoles } }`;
		const changed = await asAdmin(set, { input: { userId: user.id, staffRoles: ['NURSE', 'MIDWIFE'] } });
		expect(changed.body.data.setUserStaffRoles.staffRoles.sort()).toEqual(['MIDWIFE', 'NURSE']);
		const superAdmin = await asAdmin(set, { input: { userId: user.id, staffRoles: ['SUPER_ADMIN'] } });
		expect(superAdmin.body.errors[0].extensions.code).toBe('FORBIDDEN');
		const own = await asAdmin(set, { input: { userId: adminId, staffRoles: ['DOCTOR'] } });
		expect(own.body.errors[0].extensions.code).toBe('BAD_REQUEST');

		const listed = await asAdmin(`{ managedUsers { email staffRoles } }`);
		expect(listed.body.data.managedUsers).toEqual(
			expect.arrayContaining([{ email: 'nina@example.com', staffRoles: expect.arrayContaining(['NURSE']) }]),
		);

		await gql(SET_PASSWORD, { input: { token: tokenOf(url), password: 'Us3r-secret!' } });
		const nina = cookieOf(await signIn('nina@example.com', 'Us3r-secret!').expect(200));
		const current = await atClinic(nina, clinicId)('{ currentClinic { id userRole staffRoles } }');
		expect(current.body.data.currentClinic).toMatchObject({ id: clinicId, userRole: 'user' });
		expect(current.body.data.currentClinic.staffRoles.sort()).toEqual(['MIDWIFE', 'NURSE']);
	});

	it('deactivates a user: signs them out, refuses sign-in and links; reactivation restores sign-in', async () => {
		const { userId, cookie } = await onboard('gone@example.com');
		const setActive = `mutation A($userId: ID!, $active: Boolean!) { setUserActive(userId: $userId, active: $active) { status } }`;

		const off = await gql(setActive, { userId, active: false }, adminCookie);
		expect(off.body.data.setUserActive.status).toBe('DEACTIVATED');
		expect((await gql('{ me { id } }', {}, cookie)).body.errors[0].extensions.code).toBe('UNAUTHORIZED');
		await signIn('gone@example.com', 'Us3r-secret!').expect(403);
		expect((await gql(CREATE_LINK, { userId }, adminCookie)).body.errors[0].extensions.code).toBe('BAD_REQUEST');

		const self = await gql(setActive, { userId: adminId, active: false }, adminCookie);
		expect(self.body.errors[0].extensions.code).toBe('BAD_REQUEST');

		const on = await gql(setActive, { userId, active: true }, adminCookie);
		expect(on.body.data.setUserActive.status).toBe('ACTIVE');
		await signIn('gone@example.com', 'Us3r-secret!').expect(200);
	});

	it('changes your own password with the current one and signs out your other sessions', async () => {
		const change = `mutation C($input: ChangePasswordInput!) { changePassword(input: $input) }`;
		const other = cookieOf(await signIn(ADMIN.email, ADMIN.password).expect(200));

		const wrong = await gql(
			change,
			{ input: { currentPassword: 'nope-nope', newPassword: 'Br4nd-new!' } },
			adminCookie,
		);
		expect(wrong.body.errors[0].message).toBe('Your current password is incorrect.');

		const ok = await gql(
			change,
			{ input: { currentPassword: ADMIN.password, newPassword: 'Br4nd-new!' } },
			adminCookie,
		);
		expect(ok.body.data.changePassword).toBe(true);
		expect((await gql('{ me { id } }', {}, adminCookie)).body.data.me.id).toBe(adminId);
		expect((await gql('{ me { id } }', {}, other)).body.errors[0].extensions.code).toBe('UNAUTHORIZED');
		await signIn(ADMIN.email, ADMIN.password).expect(401);
		await signIn(ADMIN.email, 'Br4nd-new!').expect(200);
	});
});
