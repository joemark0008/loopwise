import { createFileRoute } from '@tanstack/react-router';
import { Login } from '@/feature/auth/login-page';

export const Route = createFileRoute('/_public/login')({
	validateSearch: (search: Record<string, unknown>) => ({
		error: typeof search.error === 'string' ? search.error : undefined,
		redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
	}),
	component: Login,
});
