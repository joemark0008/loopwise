// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeleteProjectDialog } from './delete-project-dialog';

const mocks = vi.hoisted(() => ({
	deleteProject: vi.fn(),
	navigate: vi.fn(),
	setActiveProjectId: vi.fn(),
	resetStore: vi.fn(),
}));

vi.mock('@apollo/client/react', () => ({
	useMutation: () => [mocks.deleteProject, { loading: false, error: undefined, reset: vi.fn() }],
}));

vi.mock('@tanstack/react-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => mocks.navigate,
	useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock('@/lib/active-project', () => ({ setActiveProjectId: mocks.setActiveProjectId }));
vi.mock('@/lib/apollo-client', () => ({ apolloClient: { resetStore: mocks.resetStore } }));

const projectId = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.deleteProject.mockResolvedValue({ data: { deleteProject: true } });
});

afterEach(cleanup);

function renderDialog(onOpenChange = vi.fn()) {
	render(<DeleteProjectDialog open onOpenChange={onOpenChange} projectId={projectId} projectName='Sales' />);
	return {
		input: screen.getByRole('textbox', { name: 'Project name confirmation' }),
		submit: screen.getByRole('button', { name: 'Delete project' }),
	};
}

describe('DeleteProjectDialog', () => {
	it('keeps delete disabled until the exact project name is typed', () => {
		const { input, submit } = renderDialog();
		expect(submit).toHaveProperty('disabled', true);

		fireEvent.change(input, { target: { value: 'sales' } });
		expect(submit).toHaveProperty('disabled', true);

		fireEvent.change(input, { target: { value: 'Sales' } });
		expect(submit).toHaveProperty('disabled', false);
	});

	it('does not delete when the name does not match', () => {
		const { input } = renderDialog();
		fireEvent.change(input, { target: { value: 'Sale' } });
		fireEvent.submit(input.closest('form')!);
		expect(mocks.deleteProject).not.toHaveBeenCalled();
	});

	it('deletes the project, clears the selection and goes home', async () => {
		const onOpenChange = vi.fn();
		const { input, submit } = renderDialog(onOpenChange);
		fireEvent.change(input, { target: { value: 'Sales' } });
		fireEvent.click(submit);

		await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' }));
		expect(mocks.deleteProject).toHaveBeenCalledWith({ variables: { projectId } });
		expect(mocks.setActiveProjectId).toHaveBeenCalledWith(null);
		expect(mocks.resetStore).toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
