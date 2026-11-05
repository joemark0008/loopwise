import type { encounterProposal } from '@loopwise/shared/tools';
import { proposeCharges, proposeMedicalCertificate, proposePrescription } from '@loopwise/shared/tools';
import type { ZodType } from 'zod/v3';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * The encounter-document proposal tools (DESIGN.md §5, §7.1): a draft prescription, medical certificate or bill for
 * one of the chart chat's encounters. They write nothing. The card reads the encounter as the clinician (so
 * row-level security and the patient check apply there) and only its Confirm button saves, as a draft, against the
 * version it showed; issuing or finalizing stays the clinician's own step. The note has its own tool
 * (`propose_encounter_note`), which reads the note here.
 */
function proposal<TInput extends { encounterId: string }>(tool: {
	description: string;
	InputSchema: ZodType<TInput>;
	OutputSchema: ZodType<encounterProposal.Output>;
}) {
	return createTool<TInput, encounterProposal.Output>({
		kind: 'propose',
		description: tool.description,
		inputSchema: tool.InputSchema,
		outputSchema: tool.OutputSchema,
		execute: async (input, context: ToolContext) => {
			if (!context.patientId) {
				throw new Error(
					"This chat isn't about a patient. Ask the user to open the patient's chart (Patients) and ask Wise there.",
				);
			}
			if (!input.encounterId?.trim()) {
				throw new Error(
					'Name the encounter: use the id from the patient record, or propose_encounter for a new visit.',
				);
			}
			return {
				_version: '1' as const,
				success: true as const,
				patientId: context.patientId,
				encounterId: input.encounterId.trim(),
			};
		},
		toModelOutput: () => ({
			type: 'text',
			value: 'Draft shown to the user. Nothing is saved yet. Stop and wait for their reply.',
		}),
	});
}

export const proposePrescriptionTool = proposal<proposePrescription.Input>(proposePrescription);
export const proposeMedicalCertificateTool = proposal<proposeMedicalCertificate.Input>(proposeMedicalCertificate);
export const proposeChargesTool = proposal<proposeCharges.Input>(proposeCharges);
