// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ClinicSwitcher } from './clinic-selector';

vi.mock('@/feature/settings/components/create-clinic-dialog', () => ({
	CreateClinicDialog: ({ open }: { open: boolean }) => (open ? <div role='dialog'>New clinic dialog</div> : null),
}));

// The command menu scrolls the active item into view, which jsdom doesn't implement.
beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
});

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

	it('only names the clinic for a non-admin with one clinic', () => {
		render(
			<ClinicSwitcher
				clinics={[{ id: 'p1', name: 'Tagbilaran', userRole: 'user' }]}
				currentClinicId='p1'
				onChange={vi.fn()}
				canCreate={false}
			/>,
		);

		expect(screen.getByText('Tagbilaran')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Switch clinic/ })).toBeNull();
	});

	it('lets a non-admin switch clinics without offering New clinic', () => {
		render(
			<ClinicSwitcher
				clinics={[
					{ id: 'p1', name: 'Tagbilaran', userRole: 'user' },
					{ id: 'p2', name: 'Panglao', userRole: 'user' },
				]}
				currentClinicId='p1'
				onChange={vi.fn()}
				canCreate={false}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Switch clinic. Current clinic: Tagbilaran' }));

		expect(screen.getByText('Panglao')).toBeTruthy();
		expect(screen.queryByText('New clinic')).toBeNull();
	});

	it('offers nothing to a non-admin with no clinic', () => {
		const { container } = render(<ClinicSwitcher clinics={[]} onChange={vi.fn()} canCreate={false} />);

		expect(container.textContent).toBe('');
	});
});
