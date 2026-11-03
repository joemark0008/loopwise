import { useState } from 'react';
import { Mail } from 'lucide-react';

import styles from './sidebar-community.module.css';
import { cn } from '@/lib/utils';
import { createLocalStorage } from '@/lib/local-storage';
import GithubIcon from '@/components/icons/github-icon.svg';
import { NewsletterSubscribeDialog } from '@/feature/settings/components/newsletter-subscribe';
import SlackIcon from '@/components/icons/slack.svg';
import {
	LOOPWISE_COMMUNITY_URL,
	LOOPWISE_NEWSLETTER_SUBSCRIBE_URL,
	LOOPWISE_REPOSITORY_URL,
} from '@/lib/loopwise-links';

interface SidebarCommunityProps {
	isCollapsed: boolean;
}

const newsletterNotificationDismissed = createLocalStorage<boolean>('newsletter-notification-dismissed', false);

export function SidebarCommunity({ isCollapsed }: SidebarCommunityProps) {
	const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);
	const [showNotification, setShowNotification] = useState(() => !newsletterNotificationDismissed.get());

	const handleNewsletterClick = () => {
		setIsNewsletterOpen(true);
		if (showNotification) {
			setShowNotification(false);
			newsletterNotificationDismissed.set(true);
		}
	};

	if (isCollapsed || (!LOOPWISE_REPOSITORY_URL && !LOOPWISE_COMMUNITY_URL && !LOOPWISE_NEWSLETTER_SUBSCRIBE_URL)) {
		return null;
	}

	return (
		<div className={styles.sidebarCommunityDiv}>
			<span className={styles.sidebarCommunitySpan}>Community</span>
			<div className={styles.sidebarCommunityDiv2}>
				{LOOPWISE_REPOSITORY_URL && (
					<a
						href={LOOPWISE_REPOSITORY_URL}
						target='_blank'
						rel='noopener noreferrer'
						className={cn(styles.sidebarCommunityA)}
						title='GitHub'
					>
						<GithubIcon className={styles.sidebarCommunityGithubIcon} />
					</a>
				)}
				{LOOPWISE_COMMUNITY_URL && (
					<a
						href={LOOPWISE_COMMUNITY_URL}
						target='_blank'
						rel='noopener noreferrer'
						className={cn(styles.sidebarCommunityA)}
						title='Join Slack'
					>
						<SlackIcon className={styles.sidebarCommunitySlackIcon} />
					</a>
				)}
				{LOOPWISE_NEWSLETTER_SUBSCRIBE_URL && (
					<button
						type='button'
						onClick={handleNewsletterClick}
						className={cn(styles.sidebarCommunityButton)}
						title='Subscribe to newsletter'
						aria-label='Subscribe to newsletter'
					>
						<Mail className={styles.sidebarCommunityGithubIcon} />
						{showNotification && <span className={styles.sidebarCommunitySpan2} aria-hidden='true' />}
					</button>
				)}
			</div>
			<NewsletterSubscribeDialog open={isNewsletterOpen} onOpenChange={setIsNewsletterOpen} />
		</div>
	);
}
