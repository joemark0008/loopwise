import { useQuery } from '@tanstack/react-query';
import { chatApi } from '@/lib/chat-api';

export const useSearchChatsQuery = (query: string, options?: { enabled?: boolean }) => {
	return useQuery({
		...chatApi.chat.search.queryOptions({ query }),
		enabled: query.length > 0 && (options?.enabled ?? true),
	});
};
