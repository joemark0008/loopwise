import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSystemPromptOverride, hasLoopwisePromptPlaceholder, injectLoopwisePrompt } from './system-prompts.js';

describe('getSystemPromptOverride (real filesystem)', () => {
	let clinicFolder: string;

	beforeEach(() => {
		clinicFolder = mkdtempSync(join(tmpdir(), 'loopwise-prompts-'));
		mkdirSync(join(clinicFolder, 'agent', 'prompts'), { recursive: true });
	});

	afterEach(() => {
		rmSync(clinicFolder, { recursive: true, force: true });
	});

	function writePrompt(filename: string, content: string): void {
		writeFileSync(join(clinicFolder, 'agent', 'prompts', filename), content, 'utf-8');
	}

	it('returns undefined for an empty prompts folder', () => {
		expect(getSystemPromptOverride(clinicFolder)).toBeUndefined();
		expect(getSystemPromptOverride(clinicFolder, 'slack')).toBeUndefined();
	});

	it('loads system.md for the web Bot and as the global fallback', () => {
		writePrompt('system.md', 'You are the org default analyst.');

		expect(getSystemPromptOverride(clinicFolder)).toBe('You are the org default analyst.');
		expect(getSystemPromptOverride(clinicFolder, 'slack')).toBe('You are the org default analyst.');
		expect(getSystemPromptOverride(clinicFolder, 'teams')).toBe('You are the org default analyst.');
	});

	it('loads a surface-specific prompt and prefers it over system.md', () => {
		writePrompt('system.md', 'Global prompt');
		writePrompt('slack.md', 'Slack-only prompt');

		expect(getSystemPromptOverride(clinicFolder, 'slack')).toBe('Slack-only prompt');
		expect(getSystemPromptOverride(clinicFolder, 'teams')).toBe('Global prompt');
		expect(getSystemPromptOverride(clinicFolder)).toBe('Global prompt');
	});

	it('ignores a README.md (not a recognized surface file)', () => {
		writePrompt('README.md', '# How to use prompts');

		expect(getSystemPromptOverride(clinicFolder)).toBeUndefined();
		expect(getSystemPromptOverride(clinicFolder, 'slack')).toBeUndefined();
	});

	it('refuses to follow a symlink that points outside the clinic folder', () => {
		const secretDir = mkdtempSync(join(tmpdir(), 'loopwise-secret-'));
		const secretFile = join(secretDir, 'secret.md');
		writeFileSync(secretFile, 'TOP SECRET HOST FILE', 'utf-8');
		symlinkSync(secretFile, join(clinicFolder, 'agent', 'prompts', 'system.md'));
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		try {
			expect(getSystemPromptOverride(clinicFolder)).toBeUndefined();
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Refusing to read system prompt override outside the clinic folder'),
			);
		} finally {
			consoleSpy.mockRestore();
			rmSync(secretDir, { recursive: true, force: true });
		}
	});

	it('composes the default prompt into a file that keeps the {{ loopwise_prompt }} placeholder', () => {
		writePrompt('slack.md', '{{ loopwise_prompt }}\n\n## House rules\n- Answer in EUR.');

		const override = getSystemPromptOverride(clinicFolder, 'slack');
		expect(override).toBeDefined();
		expect(hasLoopwisePromptPlaceholder(override!)).toBe(true);

		const composed = injectLoopwisePrompt(override!, 'DEFAULT_SLACK_PROMPT');
		expect(composed).toBe('DEFAULT_SLACK_PROMPT\n\n## House rules\n- Answer in EUR.');
	});
});
