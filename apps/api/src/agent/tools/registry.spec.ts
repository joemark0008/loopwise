import { wiseToolEntry } from '@loopwise/shared/wise-tools';
import { describe, expect, it, vi } from 'vitest';

import { readOnlyToolServices, TOOL_SERVICE_READS } from '../services/tool-services.js';
import type { ToolContext } from '../types/tools.js';
import { getToolKind, TOOL_KINDS, withToolKind } from '../utils/tools.js';
import { assertToolKinds, createWebSearchTools, getTools, uiToolset } from './index.js';

/**
 * "AI drafts, the clinician confirms" (DESIGN.md §9.1), enforced on the registry: every tool declares what it does,
 * tools only reach read methods, and a propose tool's execute only reads.
 */
describe('agent tool registry', () => {
	const webTools = createWebSearchTools('anthropic', { apiKey: 'test' }) ?? {};
	const everyTool = { ...uiToolset, ...webTools };

	it('gives every tool a kind', () => {
		const kinds = Object.fromEntries(Object.entries(everyTool).map(([name, tool]) => [name, getToolKind(tool)]));
		for (const [name, kind] of Object.entries(kinds)) {
			expect(TOOL_KINDS, `${name} has no kind`).toContain(kind);
		}
		expect(kinds).toEqual({
			clarification: 'display',
			display_chart: 'display',
			display_map: 'display',
			load_skill: 'read',
			suggest_follow_ups: 'display',
			propose_skill: 'propose',
			propose_patient_registration: 'propose',
			propose_encounter: 'propose',
			propose_encounter_note: 'propose',
			propose_prescription: 'propose',
			propose_medical_certificate: 'propose',
			propose_charges: 'propose',
			find_patient: 'read',
			open_page: 'navigate',
			chart_patient_trend: 'read',
			chart_facility_panel: 'read',
			create_report: 'read',
			describe_analytics: 'read',
			run_analytics_sql: 'read',
			get_metric: 'read',
			explain_result: 'read',
			report: 'display',
			propose_vitals: 'propose',
			propose_allergy: 'propose',
			propose_remove_allergy: 'propose',
			list_results_to_review: 'read',
			propose_result_review: 'propose',
			propose_order: 'propose',
			propose_diagnosis: 'propose',
			propose_void_diagnosis: 'propose',
			propose_void_vitals: 'propose',
			propose_cancel_order: 'propose',
			list_lab_orders: 'read',
			propose_lab_order_step: 'propose',
			propose_issue_document: 'propose',
			propose_void_document: 'propose',
			propose_bill_step: 'propose',
			propose_save_report: 'propose',
			propose_patient_update: 'propose',
			web_search: 'read',
			web_fetch: 'read',
		});
	});

	it('lists every tool the model can get in the Wise tools catalogue, with the same kind', () => {
		for (const [name, toolDefinition] of Object.entries(getTools(null, webTools))) {
			const entry = wiseToolEntry(name);
			expect(entry, `${name} is missing from WISE_TOOL_CATALOG`).toBeDefined();
			expect(entry?.kind, name).toBe(getToolKind(toolDefinition));
			expect(entry?.comingSoon, name).toBeFalsy();
		}
	});

	it('names every propose tool propose_*, and only those', () => {
		for (const [name, tool] of Object.entries(everyTool)) {
			expect(getToolKind(tool) === 'propose', name).toBe(name.startsWith('propose_'));
		}
	});

	it('refuses a tool set with an unclassified tool', () => {
		const rogue = { description: 'writes', execute: async () => ({}) };
		expect(() => getTools(null, { rogue })).toThrow(/without a kind: rogue/);
		expect(() => assertToolKinds({ ok: withToolKind('read', { execute: async () => ({}) }) })).not.toThrow();
	});

	it('hands tools frozen read-only facades, never the services', () => {
		const write = vi.fn();
		const facades = readOnlyToolServices({
			patients: { ...readMocks(TOOL_SERVICE_READS.patients), register: write, linkExisting: write },
			skills: { ...readMocks(TOOL_SERVICE_READS.skills), createSkill: write },
			encounters: { ...readMocks(TOOL_SERVICE_READS.encounters), updateNote: write },
			insights: { ...readMocks(TOOL_SERVICE_READS.insights), exportReportPdf: write },
			analytics: { ...readMocks(TOOL_SERVICE_READS.analytics) },
			reports: { ...readMocks(TOOL_SERVICE_READS.reports), exportPdf: write },
			results: { ...readMocks(TOOL_SERVICE_READS.results), review: write },
			orders: { ...readMocks(TOOL_SERVICE_READS.orders), accept: write },
			rules: { ...readMocks(TOOL_SERVICE_READS.rules), evaluateAndStore: write },
		} as never);

		expect(
			Object.fromEntries(Object.entries(facades).map(([name, facade]) => [name, Object.keys(facade)])),
		).toEqual({
			patients: ['myFacilities', 'isVisible', 'getChartSummary', 'findForWise', 'getById', 'checkDuplicates'],
			skills: ['getSkill', 'getSkills', 'getSkillBody'],
			encounters: ['getNoteForWise'],
			insights: ['patientTrend', 'facilityPanel', 'buildReport'],
			analytics: ['describe', 'run', 'metric'],
			reports: ['toolOutputs', 'versions'],
			results: ['toReviewForWise'],
			orders: ['labOrdersForWise'],
			rules: ['explainForWise'],
		});
		expect(Object.isFrozen(facades.patients)).toBe(true);
		expect('register' in facades.patients).toBe(false);
		expect(() => {
			(facades.patients as unknown as Record<string, unknown>).register = write;
		}).toThrow();
	});

	it('runs every propose tool without reaching anything but the read facades', async () => {
		const touched: string[] = [];
		const services = guard(
			{
				patients: {
					myFacilities: async () => [{ id: 'hc', name: 'Health Center', slug: 'hc' }],
					checkDuplicates: async () => [],
				},
				skills: { getSkill: () => undefined },
				encounters: {
					getNoteForWise: async () => ({
						encounter: { id: 'e1', startedAt: '2026-11-03T01:00:00.000Z', facilityName: 'Health Center' },
						patientName: 'Maria Santos',
						current: emptyNote,
						version: 1,
					}),
				},
			},
			touched,
		);
		const context = { userId: 'u', projectId: 'p', patientId: 'p1', services } as unknown as ToolContext;
		const inputs: Record<string, unknown> = {
			propose_skill: { name: 'new-skill', description: 'd', body: 'b' },
			propose_patient_registration: {
				givenName: 'Juan',
				familyName: 'Cruz',
				birthDate: '1980-01-01',
				sex: 'male',
			},
			propose_encounter: { reason: 'BP check' },
			propose_encounter_note: { plan: 'Recheck BP in 2 weeks.' },
			propose_prescription: { encounterId: 'e1', items: [] },
			propose_medical_certificate: { encounterId: 'e1' },
			propose_charges: { encounterId: 'e1' },
			propose_vitals: { encounterId: 'e1', vitals: { systolicMmHg: 150, diastolicMmHg: 95 } },
			propose_allergy: { substance: 'Penicillin' },
			propose_remove_allergy: { substance: 'Penicillin' },
			propose_result_review: { resultId: 'r1', note: 'Called the patient.' },
			propose_order: { encounterId: 'e1', tests: ['HbA1c', 'FBS'], targetFacility: 'Bohol Diagnostics' },
			propose_diagnosis: { encounterId: 'e1', icd10Code: 'E11.9', display: 'Type 2 diabetes' },
			propose_void_diagnosis: { encounterId: 'e1', icd10Code: 'E11.9' },
			propose_void_vitals: { encounterId: 'e1' },
			propose_cancel_order: { encounterId: 'e1', test: 'HbA1c' },
			propose_lab_order_step: { orderId: 'o1', step: 'accept' },
			propose_issue_document: { encounterId: 'e1', document: 'prescription' },
			propose_void_document: { encounterId: 'e1', document: 'prescription', reason: 'Wrong patient' },
			propose_bill_step: { encounterId: 'e1', step: 'finalize' },
			propose_save_report: { reportId: 'rep1' },
			propose_patient_update: { phone: '0917 000 0000' },
		};
		const proposeTools = Object.entries(everyTool).filter(([, tool]) => getToolKind(tool) === 'propose');
		expect(proposeTools.map(([name]) => name).sort()).toEqual(Object.keys(inputs).sort());

		for (const [name, tool] of proposeTools) {
			await (tool as unknown as { execute: (input: unknown, options: unknown) => Promise<unknown> }).execute(
				inputs[name],
				{
					experimental_context: context,
					toolCallId: 't',
					messages: [],
				},
			);
		}
		for (const path of touched) {
			const [service, method] = path.split('.');
			expect(TOOL_SERVICE_READS[service as keyof typeof TOOL_SERVICE_READS], path).toContain(method);
		}
	});
});

const emptyNote = {
	reason: 'Fatigue',
	history: null,
	physicalExam: null,
	assessment: null,
	plan: null,
	patientInstructions: null,
	followUpOn: null,
	notes: null,
};

const readMocks = (methods: readonly string[]) => Object.fromEntries(methods.map((method) => [method, vi.fn()]));

/** Services whose every member access is recorded; anything not stubbed throws, as a write would. */
function guard(stubs: Record<string, Record<string, unknown>>, touched: string[]) {
	return new Proxy(stubs, {
		get(target, service: string) {
			const stub = target[service];
			if (!stub) {
				throw new Error(`propose tool reached services.${service}`);
			}
			return new Proxy(stub, {
				get(methods, method: string) {
					touched.push(`${service}.${method}`);
					if (!(method in methods)) {
						throw new Error(`propose tool reached services.${service}.${method}`);
					}
					return methods[method];
				},
			});
		},
	});
}
