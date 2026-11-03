// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FindPatientToolCall } from './find-patient';
import type { ToolCallComponentProps } from '.';

vi.mock('@tanstack/react-router', () => ({
	Link: ({ params, children }: { params: { patientId: string }; children: React.ReactNode }) => (
		<a href={`/patients/${params.patientId}`}>{children}</a>
	),
}));
vi.mock('@/contexts/agent.provider', () => ({ useAgentContext: () => ({ chatId: 'chat-1' }) }));

const renderPart = (output: object, input: object = { query: 'Santos' }) =>
	render(
		<MantineProvider>
			<FindPatientToolCall
				toolPart={
					{
						type: 'tool-find_patient',
						toolCallId: 'call_1',
						state: 'output-available',
						input,
						output,
					} as unknown as ToolCallComponentProps<'find_patient'>['toolPart']
				}
			/>
		</MantineProvider>,
	);

afterEach(cleanup);

describe('FindPatientToolCall', () => {
	it('lists the matches, each linking to the chart', () => {
		renderPart({
			patients: [
				{
					id: 'p1',
					name: 'Maria Santos',
					birthDate: '1972-03-14',
					sex: 'female',
					identifiers: [{ system: 'MRN', value: 'TAG-0001' }],
				},
				{ id: 'p2', name: 'Rosa Santos', birthDate: '1990-01-02', sex: 'female', identifiers: [] },
			],
			truncated: false,
		});
		expect(screen.getByText('2 found for “Santos”')).toBeTruthy();
		const links = screen.getAllByRole('link');
		expect(links.map((link) => link.getAttribute('href'))).toEqual(['/patients/p1', '/patients/p2']);
		expect(links[0].textContent).toContain('F · born 14 Mar 1972 · MRN TAG-0001');
	});

	it('says when nothing matched', () => {
		renderPart({ patients: [], truncated: false }, { query: 'Nobody', birthDate: '1990-01-02' });
		expect(screen.getByText('No patients found for “Nobody”, born 1990-01-02')).toBeTruthy();
		expect(screen.queryAllByRole('link')).toHaveLength(0);
	});
});
