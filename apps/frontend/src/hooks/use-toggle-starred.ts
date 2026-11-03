import { useMutation } from '@tanstack/react-query';
import { chatApi } from '@/lib/chat-api';

export const useToggleStarred = () => {
	return useMutation(
		chatApi.chat.toggleStarred.mutationOptions({
			onMutate: (vars, ctx) => {
				const getKey = chatApi.chat.get.queryKey({ chatId: vars.chatId });
				const previousChat = ctx.client.getQueryData(getKey);

				ctx.client.setQueryData(getKey, (prev) => {
					if (!prev) {
						return prev;
					}
					return { ...prev, isStarred: vars.isStarred };
				});

				return { previousChat };
			},
			onError: (_err, vars, context, ctx) => {
				if (!context) {
					return;
				}
				ctx.client.setQueryData(chatApi.chat.get.queryKey({ chatId: vars.chatId }), context.previousChat);
			},
			onSettled: (_data, _err, vars, _context, ctx) => {
				ctx.client.invalidateQueries({ queryKey: [['chat', 'listGrouped']] });
				ctx.client.invalidateQueries({
					queryKey: chatApi.chat.get.queryKey({ chatId: vars.chatId }),
				});
			},
		}),
	);
};
