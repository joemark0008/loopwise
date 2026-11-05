// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClinicIdentifier } from './clinic-identifier';

const writeText = vi.fn();
const clinicId = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
	writeText.mockReset();
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText },
	});
});

afterEach(cleanup);

describe('ClinicIdentifier', () => {
	it('renders and copies the clinic ID', async () => {
		const { container } = render(<ClinicIdentifier clinicId={clinicId} />);

		expect(container.querySelector('code')?.textContent).toBe(clinicId);

		fireEvent.click(screen.getByRole('button', { name: `Copy clinic ID ${clinicId}` }));

		await waitFor(() => expect(writeText).toHaveBeenCalledWith(clinicId));
		expect(container.querySelector('.lucide-check')).toBeTruthy();
	});
});
