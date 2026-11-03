import { Outlet, useRouterState } from '@tanstack/react-router';
import { AgentProvider } from '@/contexts/agent.provider';
import { useChatId } from '@/hooks/use-chat-id';
import { useIsCloud } from '@/hooks/use-quarry-mode';
import { useChatQuery } from '@/queries/use-chat-query';
import { SetChatInputCallbackProvider } from '@/contexts/set-chat-input-callback';

export function RouteComponent() {
	const exampleSearch = useRouterState({ select: (state) => state.location.search.example === true });
	const isCloud = useIsCloud();
	const chatId = useChatId();
	const chat = useChatQuery({ chatId });
	const mode = chat.data?.isOnboarding ? 'onboarding' : isCloud && exampleSearch ? 'example' : 'default';

	return (
		<SetChatInputCallbackProvider>
			<AgentProvider mode={mode}>
				<Outlet />
			</AgentProvider>
		</SetChatInputCallbackProvider>
	);
}
