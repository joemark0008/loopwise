// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClinicSwitcher } from './clinic-selector';

vi.mock('@/feature/settings/components/create-clinic-dialog', () => ({
	CreateClinicDialog: ({ open }: { open: boolean }) => (open ? <div role='dialog'>New clinic dialog</div> : null),
}));

afterEach(cleanup);

describe('ClinicSwitcher', () => {
	it('offers to create a clinic when there is none', () => {
		render(<ClinicSwitcher clinics={[]} onChange={vi.fn()} />);

		fireEvent.click(screen.getByRole('button', { name: 'New clinic' }));

		expect(screen.getByRole('dialog').textContent).toBe('New clinic dialog');
	});

	it('shows the current clinic when there is one', () => {
		render(
			<ClinicSwitcher
				clinics={[{ id: 'p1', name: 'Sales', userRole: 'admin' }]}
				currentClinicId='p1'
				onChange={vi.fn()}
			/>,
		);

		expect(screen.getByRole('button', { name: 'Switch clinic. Current clinic: Sales' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'New clinic' })).toBeNull();
	});
});
