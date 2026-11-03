import '@fontsource-variable/inter';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import './theme/reset.css';
import '@mantine/core/styles.layer.css';
import '@mantine/notifications/styles.layer.css';
import './theme/tokens.css';
import './theme/palette.css';
import './theme/animations.css';
import './theme/global.css';
import './theme/shared-surfaces.css';
import './theme/streamdown.css';
import 'katex/dist/katex.min.css';
import { StrictMode } from 'react';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useIsDarkMode } from './contexts/theme.provider';
import { McpProvider } from './contexts/mcp';
import { TooltipProvider } from './components/ui/tooltip';
import { subscribeToExternalActiveProjectChanges } from './lib/active-project';
import { apolloClient } from './lib/apollo-client';
import { routeTree } from './routeTree.gen';
import { cssVariablesResolver, theme } from './theme';
import reportWebVitals from './reportWebVitals';
import type { ReactNode } from 'react';

// Register the router instance for type safety
declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
	interface HistoryState {
		fromMessageSend?: boolean;
		openStorySlug?: string;
		/** The chat Wise opened this page from (`open_page`), for a "Back to chat" link. */
		fromChatId?: string;
	}
}

// Create a new router instance
const router = createRouter({
	routeTree,
	context: {},
	defaultPreload: 'intent',
	scrollRestoration: true,
	defaultStructuralSharing: true,
	defaultPreloadStaleTime: 0,
});

/** Query client for state management */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
			staleTime: 5 * 60 * 1000, // 5 minutes
		},
	},
});

subscribeToExternalActiveProjectChanges(() => {
	void queryClient.invalidateQueries();
	void apolloClient.resetStore();
	void router.invalidate();
});

/** The saved theme setting is the one source of the color scheme. */
function AppMantineProvider({ children }: { children: ReactNode }) {
	const isDark = useIsDarkMode();
	return (
		<MantineProvider
			theme={theme}
			cssVariablesResolver={cssVariablesResolver}
			forceColorScheme={isDark ? 'dark' : 'light'}
		>
			{children}
		</MantineProvider>
	);
}

// Render the app
const rootElement = document.getElementById('app')!;
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<ThemeProvider>
				<AppMantineProvider>
					<ModalsProvider>
						<Notifications position='top-right' />
						<ApolloProvider client={apolloClient}>
							<QueryClientProvider client={queryClient}>
								<McpProvider>
									<TooltipProvider>
										<RouterProvider router={router} />
									</TooltipProvider>
								</McpProvider>
							</QueryClientProvider>
						</ApolloProvider>
					</ModalsProvider>
				</AppMantineProvider>
			</ThemeProvider>
		</StrictMode>,
	);
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
