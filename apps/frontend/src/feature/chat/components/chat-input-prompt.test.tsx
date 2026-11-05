// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { ChatPrompt } from './chat-input-prompt';
import { setActiveClinicId } from '@/lib/active-clinic';

const mocks = vi.hoisted(() => ({
	clinic: null as { id: string } | null,
	storage: new Map<string, string>(),
}));

vi.mock('@/hooks/use-current-clinic', () => import('@/test/current-clinic-hooks.mock'));

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: { queryKey: string[] }) => {
		switch (options.queryKey[0]) {
			case 'clinic':
				return { data: mocks.clinic };
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

/** The current clinic comes from apps/api through `clinicApi`, which reads the mocked procedures. */
vi.mock('@/lib/clinic-api', async () => {
	const { procedures } = (await import('@/test/procedures')) as unknown as { procedures: Record<string, unknown> };
	return { clinicApi: { clinic: procedures.clinic } };
});

vi.mock('@/test/procedures', () => ({
	procedures: { clinic: { getCurrent: { queryOptions: () => ({ queryKey: ['clinic'] }) } } },
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
	setActiveClinicId(null);
	mocks.clinic = null;
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it('hides cached clinic mentions when no clinic is active', () => {
	render(<ChatPrompt promptRef={{ current: null }} placeholder='' onChange={vi.fn()} />);

	expect(screen.queryByTestId('mention-Old skill')).toBeNull();
});

it('shows clinic mentions when the active clinic id is corrected', () => {
	setActiveClinicId('stale-clinic');
	mocks.clinic = { id: 'current-clinic' };
	render(<ChatPrompt promptRef={{ current: null }} placeholder='' onChange={vi.fn()} />);

	expect(screen.queryByTestId('mention-Old skill')).toBeNull();

	act(() => setActiveClinicId('current-clinic'));

	expect(screen.getByTestId('mention-Old skill')).toBeDefined();
});
