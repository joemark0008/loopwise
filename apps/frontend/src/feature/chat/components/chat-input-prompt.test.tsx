// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { ChatPrompt } from './chat-input-prompt';
import { setActiveProjectId } from '@/lib/active-project';

const mocks = vi.hoisted(() => ({
	project: null as { id: string } | null,
	storage: new Map<string, string>(),
}));

vi.mock('@/hooks/use-current-project', () => import('@/test/current-project-hooks.mock'));

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: { queryKey: string[] }) => {
		switch (options.queryKey[0]) {
			case 'project':
				return { data: mocks.project };
			case 'skills':
				return { data: [{ name: 'Old skill', description: null }], isFetching: false };
			default:
				return { data: undefined, isFetching: false };
		}
	},
}));

vi.mock('@tanstack/react-router', () => ({
	useParams: () => undefined,
}));

vi.mock('prompt-mentions', () => ({
	Prompt: ({ mentionConfigs }: { mentionConfigs: { options: { id: string; label: string }[] }[] }) => (
		<div>
			{mentionConfigs.flatMap((config) =>
				config.options.map((option) => (
					<span key={option.id} data-testid={`mention-${option.id}`}>
						{option.label}
					</span>
				)),
			)}
		</div>
	),
}));

/** The current project comes from apps/api through `projectApi`, which reads the mocked procedures. */
vi.mock('@/lib/project-api', async () => {
	const { procedures } = (await import('@/test/procedures')) as unknown as { procedures: Record<string, unknown> };
	return { projectApi: { project: procedures.project } };
});

vi.mock('@/test/procedures', () => ({
	procedures: { project: { getCurrent: { queryOptions: () => ({ queryKey: ['project'] }) } } },
}));

vi.mock('@/lib/skill-api', () => ({
	skillApi: { skill: { list: { queryOptions: () => ({ queryKey: ['skills'] }) } } },
}));

beforeEach(() => {
	mocks.storage.clear();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => mocks.storage.get(key) ?? null,
		setItem: (key: string, value: string) => mocks.storage.set(key, value),
	});
	setActiveProjectId(null);
	mocks.project = null;
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it('hides cached project mentions when no project is active', () => {
	render(<ChatPrompt promptRef={{ current: null }} placeholder='' onChange={vi.fn()} />);

	expect(screen.queryByTestId('mention-Old skill')).toBeNull();
});

it('shows project mentions when the active project id is corrected', () => {
	setActiveProjectId('stale-project');
	mocks.project = { id: 'current-project' };
	render(<ChatPrompt promptRef={{ current: null }} placeholder='' onChange={vi.fn()} />);

	expect(screen.queryByTestId('mention-Old skill')).toBeNull();

	act(() => setActiveProjectId('current-project'));

	expect(screen.getByTestId('mention-Old skill')).toBeDefined();
});
