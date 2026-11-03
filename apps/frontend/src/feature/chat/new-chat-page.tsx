import { getRouteApi, Link, Navigate } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { SYSTEM_EXAMPLE_PROJECT_ID } from '@loopwise/shared';
import styles from './new-chat-page.module.css';
import type { UIMessage } from '@loopwise/api/agent/types/chat';
import { ChatInput } from '@/feature/chat/components/chat-input';
import { ChatMessages } from '@/feature/chat/components/chat-messages/chat-messages';
import { SavedPromptSuggestions } from '@/feature/chat/components/chat-saved-prompt-suggestions';
import { TodayPage } from '@/feature/today/today-page';
import { MobileHeader } from '@/layout/mobile-header';
import { ProjectSwitcher } from '@/components/project-selector';
import { ViewerHome } from '@/feature/chat/components/viewer-home';
import { useAgentContext, useAgentMessagesSelector } from '@/contexts/agent.provider';
import { useIsDarkMode } from '@/contexts/theme.provider';
import { useMultiProject } from '@/hooks/use-multi-project';
import { useIsCloud } from '@/hooks/use-loopwise-mode';
import { usePermissions } from '@/hooks/use-permissions';
import { useStaffRole } from '@/hooks/use-staff-role';
import { useProjectSwitch } from '@/hooks/use-project-switch';
import { useSession } from '@/lib/auth-client';
import { capitalize, cn } from '@/lib/utils';
import { useCurrentProject, useProjects } from '@/hooks/use-current-project';

const Route = getRouteApi('/_protected/_chat-layout/');

export function RouteComponent() {
	const { isViewer } = usePermissions();
	const role = useStaffRole();
	if (role === 'lab') {
		// Lab staff have no Today: their home is the order worklist (docs/design-system.md, roles and homes).
		return <Navigate to='/orders' replace />;
	}
	if (isViewer) {
		return <ViewerHome />;
	}
	return <HomePage />;
}

function HomePage() {
	const { data: session } = useSession();
	const username = session?.user?.name;
	const { setAdminMode } = useAgentContext();
	const isEmptyState = useAgentMessagesSelector(checkHasNoMessages);
	const { canChatWithLoopwiseData } = usePermissions();
	const { admin: adminSearch, example: exampleSearch } = Route.useSearch();

	useEffect(() => {
		if (!canChatWithLoopwiseData) {
			return;
		}
		setAdminMode(adminSearch === true);
	}, [canChatWithLoopwiseData, adminSearch, setAdminMode]);

	const project = useCurrentProject();
	const projects = useProjects();
	const switchProject = useProjectSwitch(project.data?.id);
	const multiProjectMode = useMultiProject();
	const isCloud = useIsCloud();
	const showProjectSetupCue = project.isSuccess && project.data === null;
	const showExampleProject = isCloud && (showProjectSetupCue || exampleSearch === true);
	const stateTitle = `${username ? capitalize(username) : ''}, how can I help with your patients today?`;
	const isDark = useIsDarkMode();
	const logoSrc = isDark ? '/darkLogo.svg' : '/lightLogo.svg';
	const cardLogoSrc = isDark ? '/dark-card-logo.svg' : '/light-card-logo.svg';

	return (
		<div className={styles.homePageDiv}>
			<MobileHeader showExampleProjectInfo={showExampleProject} />
			{isEmptyState &&
				!showExampleProject &&
				multiProjectMode === 'switch' &&
				project.data &&
				(projects.data?.length ?? 0) > 1 && (
					<div className={styles.homePageDiv2}>
						<ProjectSwitcher
							projects={projects.data ?? []}
							currentProjectId={project.data.id}
							onChange={switchProject}
							variant='inline'
						/>
					</div>
				)}
			{!isEmptyState ? (
				<>
					<ChatMessages />
					<ChatInput />
				</>
			) : showExampleProject ? (
				<div className={styles.homePageDiv3}>
					<div className={styles.homePageDiv6}>
						<h1 className={styles.homePageH1}>{stateTitle}</h1>
					</div>
					<div className={styles.homePageDiv7}>
						<img src={logoSrc} alt='' aria-hidden className={styles.homePageImg} />
						<ChatInput />
						<SavedPromptSuggestions projectId={SYSTEM_EXAMPLE_PROJECT_ID} />
					</div>
				</div>
			) : showProjectSetupCue ? (
				<div className={styles.homePageDiv3}>
					<div className={styles.homePageDiv8}>
						<HomeLinkCard
							to='/settings/project'
							label='Project required'
							title='Create your first project'
							subtitle='Use New project in the project switcher to start chatting'
							logoSrc={cardLogoSrc}
						/>
					</div>
				</div>
			) : (
				<TodayPage />
			)}
		</div>
	);
}

function HomeLinkCard({
	to,
	label,
	title,
	subtitle,
	logoSrc,
}: {
	to: '/settings/project';
	label: string;
	title: string;
	subtitle: string;
	logoSrc: string;
}) {
	return (
		<Link to={to} className={cn(`${styles.homeLinkCardLink} group`, styles.homeLinkCardLink2)}>
			<img src={logoSrc} alt='' aria-hidden className={styles.homeLinkCardImg} />
			<div className={styles.homeLinkCardDiv}>
				<span className={styles.homeLinkCardSpan}>{label}</span>
				<div className={styles.homeLinkCardDiv2}>
					<span className={styles.homeLinkCardSpan2}>{title}</span>
					<span className={styles.homeLinkCardSpan3}>{subtitle}</span>
				</div>
			</div>
			<div className={styles.homeLinkCardDiv3}>
				<ArrowRight className={styles.homeLinkCardArrowRight} />
			</div>
		</Link>
	);
}

function checkHasNoMessages(messages: UIMessage[]): boolean {
	return messages.length === 0;
}
