/** The two helpers of upstream `services/gitlab.ts` the clinic config reader uses (GitLab itself is Phase 7). */
export function gitlabBaseUrl(): string {
	return process.env.GITLAB_BASE_URL?.replace(/\/$/, '') || 'https://gitlab.com';
}

export function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
