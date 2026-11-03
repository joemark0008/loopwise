import { usePublicConfig } from '@/hooks/use-public-config';

export function useIsCloud(): boolean {
	const config = usePublicConfig();
	return config.data?.loopwiseMode === 'cloud';
}
