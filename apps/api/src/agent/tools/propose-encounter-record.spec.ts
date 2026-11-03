import { describe, expect, it } from 'vitest';

import type { ToolContext } from '../types/tools.js';
import {
	proposeChargesTool,
	proposeMedicalCertificateTool,
	proposePrescriptionTool,
} from './propose-encounter-record.js';

type Execute = (input: unknown, options: unknown) => Promise<unknown>;

const run = (tool: { execute?: unknown }, input: object, patientId?: string) =>
	(tool.execute as Execute)(input, {
		experimental_context: { userId: 'u', patientId } as unknown as ToolContext,
		toolCallId: 't',
		messages: [],
	});

describe('encounter-record proposal tools', () => {
	const tools = [proposePrescriptionTool, proposeMedicalCertificateTool, proposeChargesTool];

	it("echo the chat's patient and the encounter, and write nothing", async () => {
		for (const tool of tools) {
			expect(await run(tool, { encounterId: ' e1 ', items: [] }, 'p1')).toEqual({
				_version: '1',
				success: true,
				patientId: 'p1',
				encounterId: 'e1',
			});
		}
	});

	it("refuse outside a patient's chart chat, or without an encounter", async () => {
		await expect(run(proposePrescriptionTool, { encounterId: 'e1' })).rejects.toThrow(/open the patient's chart/);
		await expect(run(proposeChargesTool, { encounterId: ' ' }, 'p1')).rejects.toThrow(/Name the encounter/);
	});

	it('tell the model nothing is saved yet', () => {
		for (const tool of tools) {
			const output = (tool as { toModelOutput: (options: unknown) => unknown }).toModelOutput({});
			expect(JSON.stringify(output)).toMatch(/Nothing is saved yet/);
		}
	});

	it('tell the model drafts are saved only by the clinician', () => {
		for (const tool of tools) {
			expect(tool.description).toMatch(/only the clinician can/);
		}
		expect(proposePrescriptionTool.description).toMatch(/saves a draft prescription/);
	});
});
