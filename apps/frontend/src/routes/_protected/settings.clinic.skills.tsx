import { createFileRoute } from '@tanstack/react-router';
import { SkillsSettings } from '@/feature/settings/components/skills/skills-settings';

export const Route = createFileRoute('/_protected/settings/clinic/skills')({
	staticData: {
		title: 'Skills',
		description: 'Playbooks the agent loads when a question matches, or that anyone can start with / in chat.',
	},
	component: SkillsSettings,
});
