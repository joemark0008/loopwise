import { createFileRoute } from '@tanstack/react-router';
import { SetPassword } from '@/feature/auth/set-password-page';

export const Route = createFileRoute('/set-password')({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === 'string' ? search.token : undefined,
	}),
	component: SetPassword,
});
