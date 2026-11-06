import type { AgentToolServices } from '../types/tools.js';

/** The services that hold clinical and clinic data; tools get read methods of them only. */
type ReadSources = {
	patients: AgentToolServices['patients'];
	skills: AgentToolServices['skills'];
	encounters: AgentToolServices['encounters'];
	insights: AgentToolServices['insights'];
	analytics: AgentToolServices['analytics'];
	reports: AgentToolServices['reports'];
	diagnostics: AgentToolServices['diagnostics'];
	scheduling: AgentToolServices['scheduling'];
	followUps: AgentToolServices['followUps'];
	attachments: AgentToolServices['attachments'];
	scribe: AgentToolServices['scribe'];
};

/**
 * The read methods tools may call, by service. A write method can't reach a tool even at runtime (DESIGN.md §7.1):
 * the facades are plain frozen objects of these methods, never the services themselves, and `registry.spec.ts` fails
 * when this list grows without review.
 */
export const TOOL_SERVICE_READS = {
	patients: ['myCareClinics', 'isVisible', 'getChartSummary', 'findForWise', 'getById', 'checkDuplicates'],
	skills: ['getSkill', 'getSkills', 'getSkillBody'],
	encounters: ['getForWise'],
	insights: ['patientTrend', 'facilityPanel', 'buildReport'],
	analytics: ['describe', 'run', 'metric'],
	reports: ['toolOutputs', 'versions'],
	diagnostics: ['labWorklistForWise', 'resultsToReviewForWise'],
	scheduling: ['appointmentsForWise', 'queueForWise'],
	followUps: ['followUpsForWise', 'referralsForWise'],
	attachments: ['readTextForWise'],
	scribe: ['draftForWise'],
} as const satisfies { [K in keyof ReadSources]: readonly (keyof ReadSources[K])[] };

export function readOnlyToolServices(sources: ReadSources): ReadSources {
	return Object.freeze(
		Object.fromEntries(
			Object.entries(TOOL_SERVICE_READS).map(([service, methods]) => {
				const source = sources[service as keyof ReadSources] as unknown as Record<
					string,
					(...args: unknown[]) => unknown
				>;
				const facade = Object.fromEntries(
					methods.map((method) => [method, (...args: unknown[]) => source[method](...args)]),
				);
				return [service, Object.freeze(facade)];
			}),
		),
	) as unknown as ReadSources;
}
