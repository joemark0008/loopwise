import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../clinical/audit/audit.service.js';
import type {
	OrganizationsService,
	UserOrganization,
} from '../clinical/clinics/organizations/organizations.service.js';
import type { ClinicalDbService, ClinicalTx } from '../clinical/rls/clinical-db.service.js';
import type { Organization, WiseToolSetting } from '../generated/prisma/client.js';
import type { WiseToolSettingsRepository } from './wise-tool-settings.repository.js';
import { WiseToolSettingsService } from './wise-tool-settings.service.js';

const HC = '0190a000-0000-7000-8000-000000000001';
const OTHER = '0190a000-0000-7000-8000-000000000002';
const USER = '0190a000-0000-7000-8000-0000000000aa';
const healthCenter = { id: HC, name: 'Tagbilaran HC' } as Organization;
const other = { id: OTHER, name: 'Bohol Family Clinic' } as Organization;

function setup(opts: { organizations: Organization[]; rows?: Partial<WiseToolSetting>[]; admins?: string[] }) {
	const set = vi.fn();
	const updated = vi.fn();
	const tx = {} as ClinicalTx;
	const settings = {
		listFor: async () => (opts.rows ?? []) as WiseToolSetting[],
		set,
	} as unknown as WiseToolSettingsRepository;
	const organizations = {
		listUserOrganizations: async (): Promise<UserOrganization[]> =>
			opts.organizations.map((organization) => ({
				organization,
				isAdmin: (opts.admins ?? []).includes(organization.id),
			})),
	} as unknown as OrganizationsService;
	const db = { asSystem: (fn: (tx: ClinicalTx) => Promise<unknown>) => fn(tx) } as unknown as ClinicalDbService;
	const audit = { updated } as unknown as AuditService;
	return { service: new WiseToolSettingsService(settings, organizations, db, audit), set, updated, tx };
}

const TOOLS = ['find_patient', 'propose_encounter', 'run_analytics_sql', 'propose_prescription'];

describe('WiseToolSettingsService', () => {
	it('has every tool on by default in an organization', async () => {
		expect(await setup({ organizations: [healthCenter] }).service.disabledToolNames(USER, TOOLS)).toEqual([]);
		expect(await setup({ organizations: [] }).service.disabledToolNames(USER, TOOLS)).toEqual([]);
	});

	it('offers a tool on in any of the user’s organizations, and checks Confirm in the record’s organization', async () => {
		const { service } = setup({
			organizations: [healthCenter, other],
			rows: [{ organizationId: OTHER, toolName: 'propose_encounter', enabled: false }],
		});
		expect(await service.disabledToolNames(USER, TOOLS)).toEqual([]);
		await expect(service.assertEnabled(USER, 'propose_encounter', HC)).resolves.toBeUndefined();
		await expect(service.assertEnabled(USER, 'propose_encounter', OTHER)).rejects.toThrow(
			/turned off in Wise settings at Bohol Family Clinic/,
		);
	});

	it('applies an organization override, then the user’s own opt-out', async () => {
		const off = setup({
			organizations: [healthCenter],
			rows: [{ organizationId: HC, toolName: 'propose_encounter', enabled: false }],
		});
		expect(await off.service.disabledToolNames(USER, TOOLS)).toEqual(['propose_encounter']);

		const optOut = setup({
			organizations: [healthCenter],
			rows: [{ userId: USER, toolName: 'run_analytics_sql', enabled: false }],
		});
		expect(await optOut.service.disabledToolNames(USER, TOOLS)).toEqual(['run_analytics_sql']);
	});

	it('keeps locked tools on, whatever the rows say', async () => {
		const { service } = setup({
			organizations: [healthCenter],
			rows: [{ userId: USER, toolName: 'find_patient', enabled: false }],
		});
		expect(await service.disabledToolNames(USER, TOOLS)).toEqual([]);
	});

	it('refuses to switch a locked tool and lets only admins change an organization', async () => {
		const { service, set } = setup({ organizations: [healthCenter], admins: [] });
		await expect(service.setMyTool(USER, 'find_patient', false)).rejects.toThrow(/can't be turned on or off/);
		await expect(service.setOrganizationTool(USER, HC, 'propose_encounter', false)).rejects.toThrow(/admins/);
		expect(set).not.toHaveBeenCalled();
	});

	it('stores only overrides (back to the default removes the row) and audits each change', async () => {
		const { service, set, updated, tx } = setup({ organizations: [healthCenter], admins: [HC] });
		await service.setOrganizationTool(USER, HC, 'propose_encounter', false);
		await service.setOrganizationTool(USER, HC, 'propose_encounter', true);
		await service.setMyTool(USER, 'propose_encounter', false);
		await service.setMyTool(USER, 'propose_encounter', true);
		expect(set.mock.calls).toEqual([
			[tx, { organizationId: HC }, 'propose_encounter', false, USER],
			[tx, { organizationId: HC }, 'propose_encounter', null, USER],
			[tx, { userId: USER }, 'propose_encounter', false, USER],
			[tx, { userId: USER }, 'propose_encounter', null, USER],
		]);
		expect(updated.mock.calls.map(([, entry]) => entry.event)).toEqual([
			'wise_tool.disable',
			'wise_tool.reset',
			'wise_tool.disable',
			'wise_tool.reset',
		]);
		expect(updated.mock.calls[0][1]).toMatchObject({ organizationId: HC, entityType: 'WiseToolSetting' });
	});

	it('shows unbuilt tools as coming soon', async () => {
		const view = await setup({ organizations: [healthCenter], admins: [HC] }).service.view(
			USER,
			null,
			new Set(TOOLS),
		);
		expect(view.organizationId).toBe(HC);
		expect(view.organizations).toEqual([{ id: HC, name: 'Tagbilaran HC', isAdmin: true }]);
		const byName = Object.fromEntries(view.tools.map((tool) => [tool.name, tool]));
		expect(byName.propose_encounter).toMatchObject({ comingSoon: false, enabled: true, organizationEnabled: true });
		expect(byName.propose_vitals).toMatchObject({ comingSoon: true, enabled: false });
		expect(byName.find_patient).toMatchObject({ locked: true, myEnabled: true });
	});
});
