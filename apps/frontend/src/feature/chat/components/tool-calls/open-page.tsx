import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { ArrowRight, PanelTop } from 'lucide-react';
import { memo, useEffect, useRef } from 'react';
import { APP_PAGES, appPageHref } from '@quarry/shared/app-pages';
import styles from './open-page.module.css';
import type { AppPageKey } from '@quarry/shared/app-pages';
import type { openPage } from '@quarry/shared/tools';
import type { FileRoutesByTo } from '@/routeTree.gen';
import type { ToolCallComponentProps } from '.';
import { ErrorMessage } from '@/components/ui/error-message';
import { useAgentContext } from '@/contexts/agent.provider';

/** Every registry path is a route of the app; a page added to `APP_PAGES` without its route fails here. */
type AppPagePath = (typeof APP_PAGES)[AppPageKey]['path'];
const registryPathsAreRoutes: AppPagePath extends keyof FileRoutesByTo ? true : never = true;
void registryPathsAreRoutes;

/** The tool calls that already moved the page: a remount, or coming back to the chat, never moves it again. */
const navigatedToolCalls = new Set<string>();

/**
 * Wise's `open_page` (DESIGN.md §9.2): a card that opens the page. When the user asked to go there, the app goes by
 * itself once, after the reply ends, and only for a reply it watched stream: reopening or replaying a chat never
 * navigates. Embedded chats (a patient's chart, the ask bar) never navigate by themselves; their card still opens
 * the page in the main view.
 */
export const OpenPageToolCall = memo(({ toolPart }: ToolCallComponentProps<'open_page'>) => {
	// A part first seen before its output streamed in this session; a stored one arrives with its output.
	const sawStream = useRef(toolPart.state !== 'output-available' && toolPart.state !== 'output-error');

	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	if (toolPart.state !== 'output-available' || !toolPart.output) {
		return null;
	}
	return <OpenPageCard toolCallId={toolPart.toolCallId} output={toolPart.output} sawStream={sawStream.current} />;
});

export function OpenPageCard({
	toolCallId,
	output,
	sawStream,
}: {
	toolCallId: string;
	output: openPage.Output;
	sawStream: boolean;
}) {
	const navigate = useNavigate();
	const { chatId, isRunning, disableNavigation } = useAgentContext();
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const sawRun = useRef(sawStream || isRunning);
	const page = APP_PAGES[output.key];
	const href = appPageHref(output.key, output.params);
	const isHere = pathname === href;

	useEffect(() => {
		if (isRunning) {
			sawRun.current = true;
			return;
		}
		if (
			!output.autoNavigate ||
			disableNavigation ||
			!sawRun.current ||
			isHere ||
			navigatedToolCalls.has(toolCallId)
		) {
			return;
		}
		navigatedToolCalls.add(toolCallId);
		void navigate({ to: href, state: { fromChatId: chatId } });
	}, [isRunning, output.autoNavigate, disableNavigation, isHere, toolCallId, navigate, href, chatId]);

	return (
		<div className={styles.openPageCard} data-testid='open-page'>
			<PanelTop className={styles.openPageIcon} />
			<span className={styles.openPageLabel}>{output.label}</span>
			{isHere ? (
				<span className={styles.openPageHere}>You are here</span>
			) : (
				<Link
					to={page.path}
					params={output.params as never}
					state={{ fromChatId: chatId }}
					className={styles.openPageLink}
				>
					Open
					<ArrowRight />
				</Link>
			)}
		</div>
	);
}
