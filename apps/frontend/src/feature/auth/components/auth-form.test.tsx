// @vitest-environment jsdom

import { useForm } from '@tanstack/react-form';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FormTextField } from '@/feature/auth/components/auth-form';

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn(), Link: () => null }));

function Harness({ onValueChange }: { onValueChange?: () => void }) {
	const form = useForm({ defaultValues: { email: '' } });
	return (
		<FormTextField
			form={form}
			name='email'
			title='Email'
			autoComplete='email'
			placeholder='admin@example.com'
			description='You will log in with this.'
			validate={(value) => (value.includes('@') ? undefined : 'Enter a valid email address.')}
			onValueChange={onValueChange}
		/>
	);
}

describe('FormTextField', () => {
	afterEach(cleanup);

	it('links the label to its input and describes it', () => {
		render(<Harness />);

		const input = screen.getByLabelText('Email');
		expect(input.getAttribute('autocomplete')).toBe('email');
		expect(input.getAttribute('placeholder')).toBe('admin@example.com');
		expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('You will log in with this.').id);
	});

	it('shows a validation error only after leaving the field, and clears it once fixed', async () => {
		render(<Harness />);
		const input = screen.getByLabelText('Email');

		fireEvent.change(input, { target: { value: 'ada' } });
		expect(screen.queryByRole('alert')).toBeNull();

		fireEvent.blur(input);
		expect((await screen.findByRole('alert')).textContent).toBe('Enter a valid email address.');
		expect(input.getAttribute('aria-invalid')).toBe('true');

		fireEvent.change(input, { target: { value: 'ada@example.com' } });
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('tells the caller when the value changes', () => {
		const onValueChange = vi.fn();
		render(<Harness onValueChange={onValueChange} />);

		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a' } });

		expect(onValueChange).toHaveBeenCalledOnce();
	});
});
