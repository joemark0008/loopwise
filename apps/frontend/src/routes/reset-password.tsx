import { createFileRoute } from '@tanstack/react-router';
import { ResetPassword } from '@/feature/auth/reset-password-page';

export const Route = createFileRoute('/reset-password')({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === 'string' ? search.token : undefined,
		error: typeof search.error === 'string' ? search.error : undefined,
	}),
	component: ResetPassword,
});
