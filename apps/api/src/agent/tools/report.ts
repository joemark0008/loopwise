import { REPORT_BLOCK_TOOLS, splitReport, ungroundedProseNumbers } from '@quarry/shared/report-blocks';
import { report } from '@quarry/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool, rememberToolOutput } from '../utils/tools.js';

/**
 * Wise reports in a side panel (DESIGN.md §9.2), ported from quarry's classic stories: create, a search/replace
 * update, a full replace, and a restore of an earlier version, each one a new version kept as this tool's output in
 * the chat. The markdown carries no numbers of its own; its blocks embed tool results of the same chat, checked here,
 * and the prose may only repeat numbers those results hold. It changes no clinical record.
 */
export default createTool<report.Input, report.Output>({
	kind: 'display',
	description: report.description,
	inputSchema: report.InputSchema,
	outputSchema: report.OutputSchema,
	execute: async (input, context, { toolCallId }) => {
		const versions = await reportVersions(context, input.id);
		const current = versions.at(-1);
		let code: string;
		switch (input.action) {
			case 'create':
				if (current) {
					throw new Error(`Report "${input.id}" exists (v${current.version}); use update or replace.`);
				}
				if (!input.code || !input.title) {
					throw new Error('create needs a title and the code.');
				}
				code = input.code;
				break;
			case 'update': {
				if (!current) {
					throw new Error(`No report "${input.id}" yet; use create.`);
				}
				if (!input.search || input.replace === undefined) {
					throw new Error('update needs search and replace.');
				}
				const at = current.code.indexOf(input.search);
				if (at < 0) {
					throw new Error(
						'search was not found in the current report; copy an exact string of it, or replace.',
					);
				}
				code = current.code.slice(0, at) + input.replace + current.code.slice(at + input.search.length);
				break;
			}
			case 'replace':
				if (!input.code) {
					throw new Error('replace needs the full code.');
				}
				code = input.code;
				break;
			case 'restore': {
				const earlier = versions.find((version) => version.version === input.version);
				if (!earlier) {
					throw new Error(`Report "${input.id}" has no version ${input.version ?? '(none given)'}.`);
				}
				code = earlier.code;
				break;
			}
		}

		const refs = await checkBlocks(context, code);
		const ungrounded = ungroundedProseNumbers(
			code,
			refs.map((ref) => ref.output),
		);
		if (ungrounded.length > 0) {
			throw new Error(
				`The report's text has numbers none of its embedded results contains (${ungrounded.join(', ')}). Show numbers through <chart>/<table>/<sections> blocks, or call the tool that returns them first.`,
			);
		}
		const patientId = input.patientId?.trim() || current?.patientId || context.patientId || null;
		if (patientId && !(await context.services.patients.isVisible(context.userId, patientId))) {
			throw new Error('Patient not found. Use find_patient and only ids it returned.');
		}
		return rememberToolOutput(context, toolCallId, 'report', {
			_version: '1' as const,
			id: input.id,
			version: (current?.version ?? 0) + 1,
			action: input.action,
			title: input.title?.trim() || current?.title || input.id,
			code,
			patientId,
			refs: refs.map((ref) => ref.toolCallId),
		});
	},
	toModelOutput: ({ output }) => ({
		type: 'text',
		value: `Report "${output.title}" v${output.version} is open in the side panel next to the chat. Don't repeat it; reply in one line. Change it later with update (search/replace) or replace; the clinician can download, print or save it to the chart from the panel.`,
	}),
});

/** The versions of a report: saved ones from earlier turns, then this run's, oldest first. */
async function reportVersions(context: ToolContext, reportId: string): Promise<report.Output[]> {
	const saved = await context.services.reports.versions(context.userId, context.chatId, reportId);
	const thisRun = [...(context.toolOutputs?.values() ?? [])]
		.filter(({ toolName }) => toolName === 'report')
		.map(({ output }) => output as report.Output)
		.filter((output) => output.id === reportId);
	const byVersion = new Map([...saved, ...thisRun].map((version) => [version.version, version]));
	return [...byVersion.values()].sort((a, b) => a.version - b.version);
}

/** Every block must embed a result of this chat from a tool that block can show; charts need a chart. */
async function checkBlocks(context: ToolContext, code: string) {
	const blocks = splitReport(code).filter((segment) => segment.kind !== 'markdown') as {
		kind: keyof typeof REPORT_BLOCK_TOOLS;
		ref: string;
	}[];
	const missing = blocks.map((block) => block.ref).filter((ref) => !context.toolOutputs?.has(ref));
	const saved = await context.services.reports.toolOutputs(context.userId, context.chatId, [...new Set(missing)]);
	return blocks.map((block) => {
		const result = context.toolOutputs?.get(block.ref) ?? saved[block.ref];
		if (!result) {
			throw new Error(
				`<${block.kind} ref="${block.ref}"/> is not a tool call of this chat; use the id of a call you made.`,
			);
		}
		if (!REPORT_BLOCK_TOOLS[block.kind].includes(result.toolName)) {
			throw new Error(
				`<${block.kind}> can't show a ${result.toolName} result; it takes ${REPORT_BLOCK_TOOLS[block.kind].join(', ')}.`,
			);
		}
		if (block.kind === 'chart' && !(result.output as { chart?: unknown }).chart) {
			throw new Error(
				`The ${result.toolName} result ${block.ref} has no chart; call it again with a chart, or use <table>.`,
			);
		}
		return { toolCallId: block.ref, ...result };
	});
}
