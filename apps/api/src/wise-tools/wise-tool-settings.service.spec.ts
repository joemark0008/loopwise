import { describe, expect, it, vi } from 'vitest';

import type { Organization, WiseToolSetting } from '../generated/prisma/client.js';
import type { OrganizationRepository } from '../organizations/organization.repository.js';
import type { WiseToolSettingsRepository } from './wise-tool-settings.repository.js';
import { WiseToolSettingsService } from './wise-tool-settings.service.js';

const clinic = { id: 'hc', name: 'Tagbilaran HC', type: 'clinic' } as Organization;
const lab = { id: 'lab', name: 'Bohol Diagnostics', type: 'lab' } as Organization;

function setup(opts: { facilities: Organization[]; rows?: Partial<WiseToolSetting>[]; admins?: string[] }) {
	const set = vi.fn();
	const settings = {
		listFor: async () => (opts.rows ?? []) as WiseToolSetting[],
		isOrgAdmin: async (_userId: string, orgId: string) => (opts.admins ?? []).includes(orgId),
		set,
	} as unknown as WiseToolSettingsRepository;
	const organizations = { getUserFacilities: async () => opts.facilities } as unknown as OrganizationRepository;
	return { service: new WiseToolSettingsService(settings, organizations), set };
}

const TOOLS = ['find_patient', 'propose_encounter', 'run_analytics_sql', 'propose_prescription'];

describe('WiseToolSettingsService', () => {
	it('uses the facility type defaults: a lab gets no chart-writing tools', async () => {
		expect(await setup({ facilities: [clinic] }).service.disabledToolNames('u', TOOLS)).toEqual([]);
		expect(await setup({ facilities: [lab] }).service.disabledToolNames('u', TOOLS)).toEqual([
			'propose_encounter',
			'propose_prescription',
		]);
	});

	it('offers a tool on at any of the user’s facilities, and checks Confirm at the record’s facility', async () => {
		const { service } = setup({ facilities: [clinic, lab] });
		expect(await service.disabledToolNames('u', TOOLS)).toEqual([]);
		await expect(service.assertEnabled('u', 'propose_encounter', 'hc')).resolves.toBeUndefined();
		await expect(service.assertEnabled('u', 'propose_encounter', 'lab')).rejects.toThrow(
			/turned off in Wise settings at Bohol Diagnostics/,
		);
	});

	it('applies a facility override, then the user’s own opt-out', async () => {
		const off = setup({
			facilities: [clinic],
			rows: [{ orgId: 'hc', toolName: 'propose_encounter', enabled: false }],
		});
		expect(await off.service.disabledToolNames('u', TOOLS)).toEqual(['propose_encounter']);

		const optOut = setup({
			facilities: [clinic],
			rows: [{ userId: 'u', toolName: 'run_analytics_sql', enabled: false }],
		});
		expect(await optOut.service.disabledToolNames('u', TOOLS)).toEqual(['run_analytics_sql']);
	});

	it('keeps locked tools on, whatever the rows say', async () => {
		const { service } = setup({
			facilities: [clinic],
			rows: [{ userId: 'u', toolName: 'find_patient', enabled: false }],
		});
		expect(await service.disabledToolNames('u', TOOLS)).toEqual([]);
	});

	it('refuses to switch a locked tool and lets only admins change a facility', async () => {
		const { service, set } = setup({ facilities: [clinic], admins: [] });
		await expect(service.setMyTool('u', 'find_patient', false)).rejects.toThrow(/can't be turned on or off/);
		await expect(service.setFacilityTool('u', 'hc', 'propose_encounter', false)).rejects.toThrow(/admins/);
		expect(set).not.toHaveBeenCalled();
	});

	it('stores only overrides: back to the default removes the row', async () => {
		const { service, set } = setup({ facilities: [clinic], admins: ['hc'] });
		await service.setFacilityTool('u', 'hc', 'propose_encounter', false);
		await service.setFacilityTool('u', 'hc', 'propose_encounter', true);
		await service.setMyTool('u', 'propose_encounter', false);
		await service.setMyTool('u', 'propose_encounter', true);
		expect(set.mock.calls).toEqual([
			[{ orgId: 'hc' }, 'propose_encounter', false, 'u'],
			[{ orgId: 'hc' }, 'propose_encounter', null, 'u'],
			[{ userId: 'u' }, 'propose_encounter', false, 'u'],
			[{ userId: 'u' }, 'propose_encounter', null, 'u'],
		]);
	});

	it('shows unbuilt tools as coming soon', async () => {
		const view = await setup({ facilities: [clinic], admins: ['hc'] }).service.view('u', null, new Set(TOOLS));
		expect(view.facilityId).toBe('hc');
		expect(view.facilities).toEqual([{ id: 'hc', name: 'Tagbilaran HC', type: 'clinic', isAdmin: true }]);
		const byName = Object.fromEntries(view.tools.map((tool) => [tool.name, tool]));
		expect(byName.propose_encounter).toMatchObject({ comingSoon: false, enabled: true, facilityEnabled: true });
		expect(byName.propose_referral).toMatchObject({ comingSoon: true, enabled: false });
		expect(byName.find_patient).toMatchObject({ locked: true, myEnabled: true });
	});
});
