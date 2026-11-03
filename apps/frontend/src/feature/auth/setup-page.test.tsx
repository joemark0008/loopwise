// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReactNode } from 'react';
import { Setup } from '@/feature/auth/setup-page';

const mocks = vi.hoisted(() => ({
	formValues: {} as Record<string, string>,
	navigate: vi.fn(),
	completeSetup: vi.fn(),
	markSetupComplete: vi.fn(),
	signInEmail: vi.fn(),
	invalidateSession: vi.fn(),
	clearApolloCache: vi.fn(),
	rememberSignInMethod: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock('@tanstack/react-form', () => ({
	useForm: (options: { onSubmit: (input: { value: Record<string, string> }) => Promise<void> }) => ({
		submit: () => options.onSubmit({ value: mocks.formValues }),
	}),
}));

vi.mock('@/feature/auth/components/auth-form', () => ({
	AuthForm: ({
		children,
		form,
		serverError,
		title,
	}: {
		children?: ReactNode;
		form?: { submit: () => Promise<void> };
		serverError?: string;
		title: string;
	}) => (
		<div>
			<h1>{title}</h1>
			{serverError && <p role='alert'>{serverError}</p>}
			{children}
			<button onClick={() => void form?.submit()}>Submit</button>
		</div>
	),
	FormTextField: ({
		name,
		error,
		description,
		onValueChange,
	}: {
		name: string;
		error?: string;
		description?: ReactNode;
		onValueChange?: () => void;
	}) => (
		<div>
			<button onClick={onValueChange}>Edit {name}</button>
			{description && <small>{description}</small>}
			{error && <p role='alert'>{error}</p>}
		</div>
	),
}));

vi.mock('@/lib/setup-api', () => ({
	completeSetup: (...args: unknown[]) => mocks.completeSetup(...args),
	markSetupComplete: () => mocks.markSetupComplete(),
}));
vi.mock('@/lib/auth-client', () => ({ signIn: { email: (...args: unknown[]) => mocks.signInEmail(...args) } }));
vi.mock('@/lib/session', () => ({ invalidateSession: () => mocks.invalidateSession() }));
vi.mock('@/lib/apollo-client', () => ({ clearApolloCache: () => mocks.clearApolloCache() }));
vi.mock('@/lib/last-sign-in-method', () => ({
	rememberSignInMethod: (...args: unknown[]) => mocks.rememberSignInMethod(...args),
}));

describe('Setup page', () => {
	beforeEach(() => {
		mocks.formValues = { token: 'tok', name: 'Ada', email: 'ada@example.com', password: 'password123' };
		for (const mock of Object.values(mocks)) {
			if (typeof mock === 'function' && 'mockReset' in mock) {
				mock.mockReset();
			}
		}
		mocks.clearApolloCache.mockResolvedValue(undefined);
		mocks.signInEmail.mockResolvedValue({ error: null });
	});

	afterEach(cleanup);

	it('signs in and goes home after setup', async () => {
		mocks.completeSetup.mockResolvedValue({ status: 'ok' });

		render(<Setup />);
		fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' }));
		expect(mocks.completeSetup).toHaveBeenCalledWith(mocks.formValues);
		expect(mocks.markSetupComplete).toHaveBeenCalled();
		expect(mocks.signInEmail).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'password123' });
		expect(mocks.invalidateSession).toHaveBeenCalled();
		expect(mocks.clearApolloCache).toHaveBeenCalled();
		expect(mocks.rememberSignInMethod).toHaveBeenCalledWith('email');
	});

	it('shows an inline error for a wrong token and keeps the other fields', async () => {
		mocks.completeSetup.mockResolvedValue({ status: 'invalid-token' });

		render(<Setup />);
		fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		expect((await screen.findByRole('alert')).textContent).toBe('Invalid setup token.');
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(mocks.signInEmail).not.toHaveBeenCalled();
		expect(screen.getByRole('heading', { name: 'Set up Loopwise' })).toBeTruthy();
	});

	it('goes to /login when someone else finished first', async () => {
		mocks.completeSetup.mockResolvedValue({ status: 'already-complete' });

		render(<Setup />);
		fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		await waitFor(() =>
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: '/login',
				search: { error: undefined, redirect: undefined },
				replace: true,
			}),
		);
		expect(mocks.markSetupComplete).toHaveBeenCalled();
	});

	it('goes to /login when the admin was created but sign-in fails', async () => {
		mocks.completeSetup.mockResolvedValue({ status: 'ok' });
		mocks.signInEmail.mockResolvedValue({ error: { message: 'boom' } });

		render(<Setup />);
		fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		await waitFor(() =>
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: '/login',
				search: {
					error: expect.stringContaining('Your admin account was created, but signing in failed'),
					redirect: undefined,
				},
				replace: true,
			}),
		);
		expect(mocks.markSetupComplete).toHaveBeenCalled();
	});

	it('shows other errors on the form', async () => {
		mocks.completeSetup.mockResolvedValue({ status: 'error', message: 'password too short' });

		render(<Setup />);
		fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		expect((await screen.findByRole('alert')).textContent).toBe('password too short');
	});

	it('clears the token error as soon as the token is edited', async () => {
		mocks.completeSetup.mockResolvedValue({ status: 'invalid-token' });

		render(<Setup />);
		fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
		await screen.findByRole('alert');

		fireEvent.click(screen.getByRole('button', { name: 'Edit token' }));

		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('guides the installer: what this is, where the token is, and the password rule', () => {
		render(<Setup />);

		expect(screen.getByText(/Create the first admin account/)).toBeTruthy();
		expect(screen.getByText(/Printed in the server logs when Loopwise starts/)).toBeTruthy();
		expect(screen.getByText(/logs loopwise \| grep "setup token"/)).toBeTruthy();
		expect(screen.getByText('At least 8 characters.')).toBeTruthy();
	});
});
