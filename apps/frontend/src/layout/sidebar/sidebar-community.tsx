import { useState } from 'react';
import { Mail } from 'lucide-react';

import styles from './sidebar-community.module.css';
import { cn } from '@/lib/utils';
import { createLocalStorage } from '@/lib/local-storage';
import GithubIcon from '@/components/icons/github-icon.svg';
import { NewsletterSubscribeDialog } from '@/feature/settings/components/newsletter-subscribe';
import SlackIcon from '@/components/icons/slack.svg';
import { QUARRY_COMMUNITY_URL, QUARRY_NEWSLETTER_SUBSCRIBE_URL, QUARRY_REPOSITORY_URL } from '@/lib/quarry-links';

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

	if (isCollapsed || (!QUARRY_REPOSITORY_URL && !QUARRY_COMMUNITY_URL && !QUARRY_NEWSLETTER_SUBSCRIBE_URL)) {
		return null;
	}

	return (
		<div className={styles.sidebarCommunityDiv}>
			<span className={styles.sidebarCommunitySpan}>Community</span>
			<div className={styles.sidebarCommunityDiv2}>
				{QUARRY_REPOSITORY_URL && (
					<a
						href={QUARRY_REPOSITORY_URL}
						target='_blank'
						rel='noopener noreferrer'
						className={cn(styles.sidebarCommunityA)}
						title='GitHub'
					>
						<GithubIcon className={styles.sidebarCommunityGithubIcon} />
					</a>
				)}
				{QUARRY_COMMUNITY_URL && (
					<a
						href={QUARRY_COMMUNITY_URL}
						target='_blank'
						rel='noopener noreferrer'
						className={cn(styles.sidebarCommunityA)}
						title='Join Slack'
					>
						<SlackIcon className={styles.sidebarCommunitySlackIcon} />
					</a>
				)}
				{QUARRY_NEWSLETTER_SUBSCRIBE_URL && (
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
