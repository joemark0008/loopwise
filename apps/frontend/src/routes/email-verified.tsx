import { createFileRoute } from '@tanstack/react-router';
import { EmailVerified } from '@/feature/auth/email-verified-page';

export const Route = createFileRoute('/email-verified')({
	validateSearch: (search: Record<string, unknown>) => ({
		error: typeof search.error === 'string' ? search.error : undefined,
		redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
	}),
	component: EmailVerified,
});
