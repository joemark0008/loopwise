import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useSmtpSetup } from '@/hooks/use-public-config';

export function useRedirectIfSmtpNotSetup() {
	const navigate = useNavigate();
	const isSmtpSetup = useSmtpSetup();

	useEffect(() => {
		if (isSmtpSetup.data === false) {
			navigate({ to: '/login', search: { error: undefined, redirect: undefined } });
		}
	}, [isSmtpSetup.data, navigate]);

	return isSmtpSetup.isPending;
}
