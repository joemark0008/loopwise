import { createFileRoute } from '@tanstack/react-router';
import { ForgotPassword } from '@/feature/auth/forgot-password-page';

export const Route = createFileRoute('/_public/forgot-password')({
	component: ForgotPassword,
});
