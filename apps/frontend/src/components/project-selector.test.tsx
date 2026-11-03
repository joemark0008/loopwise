// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectSwitcher } from './project-selector';

vi.mock('@/feature/settings/components/create-project-dialog', () => ({
	CreateProjectDialog: ({ open }: { open: boolean }) => (open ? <div role='dialog'>New project dialog</div> : null),
}));

afterEach(cleanup);

describe('ProjectSwitcher', () => {
	it('offers to create a project when there is none', () => {
		render(<ProjectSwitcher projects={[]} onChange={vi.fn()} />);

		fireEvent.click(screen.getByRole('button', { name: 'New project' }));

		expect(screen.getByRole('dialog').textContent).toBe('New project dialog');
	});

	it('shows the current project when there is one', () => {
		render(
			<ProjectSwitcher
				projects={[{ id: 'p1', name: 'Sales', userRole: 'admin' }]}
				currentProjectId='p1'
				onChange={vi.fn()}
			/>,
		);

		expect(screen.getByRole('button', { name: 'Switch project. Current project: Sales' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'New project' })).toBeNull();
	});
});
