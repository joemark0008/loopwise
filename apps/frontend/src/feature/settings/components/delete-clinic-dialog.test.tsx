// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeleteClinicDialog } from './delete-clinic-dialog';

const mocks = vi.hoisted(() => ({
	deleteClinic: vi.fn(),
	navigate: vi.fn(),
	setActiveClinicId: vi.fn(),
	resetStore: vi.fn(),
}));

vi.mock('@apollo/client/react', () => ({
	useMutation: () => [mocks.deleteClinic, { loading: false, error: undefined, reset: vi.fn() }],
}));

vi.mock('@tanstack/react-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => mocks.navigate,
	useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock('@/lib/active-clinic', () => ({ setActiveClinicId: mocks.setActiveClinicId }));
vi.mock('@/lib/apollo-client', () => ({ apolloClient: { resetStore: mocks.resetStore } }));

const clinicId = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.deleteClinic.mockResolvedValue({ data: { deleteClinic: true } });
});

afterEach(cleanup);

function renderDialog(onOpenChange = vi.fn()) {
	render(<DeleteClinicDialog open onOpenChange={onOpenChange} clinicId={clinicId} clinicName='Sales' />);
	return {
		input: screen.getByRole('textbox', { name: 'Clinic name confirmation' }),
		submit: screen.getByRole('button', { name: 'Delete clinic' }),
	};
}

describe('DeleteClinicDialog', () => {
	it('keeps delete disabled until the exact clinic name is typed', () => {
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
		expect(mocks.deleteClinic).not.toHaveBeenCalled();
	});

	it('deletes the clinic, clears the selection and goes home', async () => {
		const onOpenChange = vi.fn();
		const { input, submit } = renderDialog(onOpenChange);
		fireEvent.change(input, { target: { value: 'Sales' } });
		fireEvent.click(submit);

		await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' }));
		expect(mocks.deleteClinic).toHaveBeenCalledWith({ variables: { clinicId } });
		expect(mocks.setActiveClinicId).toHaveBeenCalledWith(null);
		expect(mocks.resetStore).toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
