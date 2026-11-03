// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReactNode } from 'react';
import { SetPassword } from '@/feature/auth/set-password-page';

const mocks = vi.hoisted(() => ({
	search: { token: 'tok' as string | undefined },
	formValues: {} as Record<string, string>,
	navigate: vi.fn(),
	getPasswordLink: vi.fn(),
	setPasswordWithLink: vi.fn(),
	signInEmail: vi.fn(),
	invalidateSession: vi.fn(),
	clearApolloCache: vi.fn(),
	rememberSignInMethod: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
	getRouteApi: () => ({ useSearch: () => mocks.search }),
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
	FormTextField: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock('@/lib/password-link-api', () => ({
	getPasswordLink: (...args: unknown[]) => mocks.getPasswordLink(...args),
	setPasswordWithLink: (...args: unknown[]) => mocks.setPasswordWithLink(...args),
}));
vi.mock('@/lib/auth-client', () => ({ signIn: { email: (...args: unknown[]) => mocks.signInEmail(...args) } }));
vi.mock('@/lib/session', () => ({ invalidateSession: () => mocks.invalidateSession() }));
vi.mock('@/lib/apollo-client', () => ({ clearApolloCache: () => mocks.clearApolloCache() }));
vi.mock('@/lib/last-sign-in-method', () => ({
	rememberSignInMethod: (...args: unknown[]) => mocks.rememberSignInMethod(...args),
}));

describe('Set password page', () => {
	beforeEach(() => {
		mocks.search = { token: 'tok' };
		mocks.formValues = { password: 'password123', confirmPassword: 'password123' };
		for (const mock of Object.values(mocks)) {
			if (typeof mock === 'function' && 'mockReset' in mock) {
				mock.mockReset();
			}
		}
		mocks.getPasswordLink.mockResolvedValue({ name: 'Grace', email: 'grace@example.com', isInvite: true });
		mocks.clearApolloCache.mockResolvedValue(undefined);
		mocks.signInEmail.mockResolvedValue({ error: null });
	});

	afterEach(cleanup);

	it('welcomes an invited user, sets the password, signs in and goes home', async () => {
		mocks.setPasswordWithLink.mockResolvedValue({ status: 'ok', email: 'grace@example.com' });

		render(<SetPassword />);
		expect(await screen.findByRole('heading', { name: 'Welcome to Loopwise' })).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' }));
		expect(mocks.getPasswordLink).toHaveBeenCalledWith('tok');
		expect(mocks.setPasswordWithLink).toHaveBeenCalledWith('tok', 'password123');
		expect(mocks.signInEmail).toHaveBeenCalledWith({ email: 'grace@example.com', password: 'password123' });
		expect(mocks.invalidateSession).toHaveBeenCalled();
		expect(mocks.clearApolloCache).toHaveBeenCalled();
	});

	it('titles a reset link as a reset', async () => {
		mocks.getPasswordLink.mockResolvedValue({ name: 'Grace', email: 'grace@example.com', isInvite: false });

		render(<SetPassword />);
		expect(await screen.findByRole('heading', { name: 'Reset your password' })).toBeTruthy();
	});

	it('explains an invalid or expired link', async () => {
		mocks.getPasswordLink.mockResolvedValue(null);

		render(<SetPassword />);
		expect(await screen.findByRole('heading', { name: 'Invalid or expired link' })).toBeTruthy();
	});

	it('treats a missing token as invalid without calling the API', async () => {
		mocks.search = { token: undefined };

		render(<SetPassword />);
		expect(await screen.findByRole('heading', { name: 'Invalid or expired link' })).toBeTruthy();
		expect(mocks.getPasswordLink).not.toHaveBeenCalled();
	});

	it('refuses mismatched passwords before calling the API', async () => {
		mocks.formValues = { password: 'password123', confirmPassword: 'password124' };

		render(<SetPassword />);
		await screen.findByRole('heading', { name: 'Welcome to Loopwise' });
		fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		expect((await screen.findByRole('alert')).textContent).toBe('Passwords do not match.');
		expect(mocks.setPasswordWithLink).not.toHaveBeenCalled();
	});

	it('switches to the invalid state when the link was used in the meantime', async () => {
		mocks.setPasswordWithLink.mockResolvedValue({ status: 'invalid-link' });

		render(<SetPassword />);
		await screen.findByRole('heading', { name: 'Welcome to Loopwise' });
		fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		expect(await screen.findByRole('heading', { name: 'Invalid or expired link' })).toBeTruthy();
		expect(mocks.signInEmail).not.toHaveBeenCalled();
	});

	it('goes to /login when the password is set but sign-in fails', async () => {
		mocks.setPasswordWithLink.mockResolvedValue({ status: 'ok', email: 'grace@example.com' });
		mocks.signInEmail.mockResolvedValue({ error: { message: 'boom' } });

		render(<SetPassword />);
		await screen.findByRole('heading', { name: 'Welcome to Loopwise' });
		fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		await waitFor(() =>
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: '/login',
				search: { error: 'Your password is set. Log in with it.', redirect: undefined },
				replace: true,
			}),
		);
	});
});
