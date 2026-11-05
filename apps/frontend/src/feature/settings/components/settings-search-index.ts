export interface SettingsSearchEntry {
	page: string;
	pageLabel: string;
	section?: string;
	title: string;
	description?: string;
	keywords?: string[];
	search?: Record<string, string>;
	adminOnly?: boolean;
	/** Hidden from admins, who see the admin version of the same section instead. */
	nonAdminOnly?: boolean;
	/** Visible to admins and context admins (observability surfaces). */
	adminOrContextAdmin?: boolean;
	cloudHidden?: boolean;
	betaSubagentsOnly?: boolean;
}

export const settingsSearchIndex: SettingsSearchEntry[] = [
	// ── Account ──────────────────────────────────────────────
	{
		page: '/settings/account',
		pageLabel: 'Account',
		title: 'Profile',
		description: 'Manage your name, email, and sign out.',
		keywords: ['name', 'email', 'sign out', 'logout', 'avatar'],
	},
	{
		page: '/settings/account',
		pageLabel: 'Account',
		title: 'Password',
		description: 'Change your password; your other sessions are signed out.',
		keywords: ['password', 'change password', 'reset', 'security', 'credentials'],
	},
	{
		page: '/settings/account',
		pageLabel: 'Account',
		section: 'General Settings',
		title: 'Sound notification',
		description: 'Play a sound when the agent finishes responding.',
		keywords: ['audio', 'alert', 'notification sound'],
	},
	{
		page: '/settings/account',
		pageLabel: 'Account',
		section: 'General Settings',
		title: 'Tool Call Density',
		description: 'Adjust how much detail is shown for tool calls.',
		keywords: ['compact', 'detailed', 'collapse', 'expand', 'tool calls', 'density', 'verbosity'],
	},
	{
		page: '/settings/account',
		pageLabel: 'Account',
		section: 'General Settings',
		title: 'Theme',
		description: 'Choose how Loopwise looks.',
		keywords: ['dark mode', 'light mode', 'appearance', 'color scheme'],
	},
	{
		page: '/settings/account',
		pageLabel: 'Account',
		section: 'General Settings',
		title: 'Newsletter',
		description: 'Subscribe to Loopwise product updates, release notes, and analytics agent tips.',
		keywords: ['email', 'mail', 'subscribe', 'updates', 'release notes'],
	},
	{
		page: '/settings/account',
		pageLabel: 'Account',
		section: 'Your memory',
		title: 'Your memory',
		description: 'What Loopwise remembers about you. Only you can see and manage these.',
		keywords: ['remember', 'learn', 'personalization', 'preferences', 'remembered facts', 'memory list'],
	},
	{
		page: '/settings/account',
		pageLabel: 'Account',
		title: 'Danger Zone',
		description: 'Delete your account or perform other destructive actions.',
		keywords: ['delete account', 'remove'],
	},

	// ── Organization ─────────────────────────────────────────

	// ── Clinic Settings ─────────────────────────────────────
	{
		page: '/settings/clinic',
		pageLabel: 'Clinic Settings',
		title: 'Information',
		description: 'View or rename your clinic and see its filesystem path.',
		keywords: ['clinic name', 'rename clinic', 'clinic path'],
	},

	// ── Clinic > Budget ─────────────────────────────────────

	// ── Appearance ───────────────────────────────────────────
	{
		page: '/settings/appearance',
		pageLabel: 'Appearance',
		search: { tab: 'general' },
		title: 'Appearance',
		description: 'Control how Loopwise formats dates and displays map boundaries.',
		keywords: ['look', 'format', 'display', 'date', 'map', 'geojson'],
	},
	{
		page: '/settings/appearance',
		pageLabel: 'Appearance',
		search: { tab: 'general' },
		title: 'Date format',
		description: 'Choose how dates are displayed in charts, tooltips and query result tables.',
		keywords: [
			'date',
			'format',
			'locale',
			'european',
			'american',
			'iso',
			'dd/mm/yyyy',
			'mm/dd/yyyy',
			'custom',
			'pattern',
		],
	},
	// ── Clinic > Skills ─────────────────────────────────
	{
		page: '/settings/clinic/skills',
		pageLabel: 'Skills',
		section: 'Skills',
		title: 'Clinic skills',
		description: 'Create and edit the playbooks the agent loads when a question matches.',
		keywords: ['skill', 'skills', 'playbook', 'instructions', 'slash', 'builder'],
		adminOrContextAdmin: true,
	},
	// ── Clinic > Agent > Models ─────────────────────────────
	{
		page: '/settings/clinic/agent',
		pageLabel: 'Agent',
		section: 'Models',
		search: { tab: 'models' },
		title: 'LLM Configuration',
		description: 'Configure the LLM providers for the agent in this clinic.',
		keywords: [
			'openai',
			'anthropic',
			'google',
			'qwen',
			'minimax',
			'moonshot',
			'kimi',
			'meta',
			'muse',
			'requesty',
			'llm',
			'model',
			'provider',
			'api key',
			'openai compatible',
			'base url',
			'endpoint',
			'vllm',
			'litellm',
			'self-hosted',
		],
		adminOnly: true,
	},
	{
		page: '/settings/clinic/agent',
		pageLabel: 'Agent',
		section: 'Models',
		search: { tab: 'models' },
		title: 'Model parameters',
		description:
			'Fine-tune per-model inference parameters like temperature, top_p, top_k, max tokens and thinking effort.',
		keywords: [
			'temperature',
			'top_p',
			'top p',
			'top_k',
			'top k',
			'max tokens',
			'thinking',
			'thinking display',
			'reasoning',
			'inference',
			'sampling',
			'claude',
		],
	},
	{
		page: '/settings/clinic/agent',
		pageLabel: 'Agent',
		section: 'Models',
		search: { tab: 'models' },
		title: 'Default models',
		description:
			'Choose the model new chats start on, the model each messaging integration and the MCP ask_loopwise tool answer with, and the models behind background tasks.',
		keywords: [
			'default model',
			'chat model',
			'new chats',
			'slack model',
			'teams model',
			'telegram model',
			'whatsapp model',
			'mattermost model',
			'mcp model',
			'ask_loopwise',
			'background',
			'live story',
			'title generation',
			'compaction',
			'context recommendations',
			'summary model',
			'extractor model',
			'fallback',
			'per category',
		],
		adminOnly: true,
	},
	{
		page: '/settings/clinic/agent',
		pageLabel: 'Agent',
		section: 'Models',
		search: { tab: 'models' },
		title: 'Transcription',
		description: 'Configure speech-to-text transcription provider and model.',
		keywords: ['voice', 'speech', 'microphone', 'whisper', 'stt'],
	},

	// ── Clinic > Agent ──────────────────────────────────────
	{
		page: '/settings/clinic/agent',
		pageLabel: 'Agent',
		section: 'Capabilities',
		search: { tab: 'tools' },
		title: 'Clinic memory',
		description: 'Controls memory for everyone in this clinic. When off, no member can use memory.',
		keywords: ['remember', 'learn', 'personalization'],
		adminOnly: true,
	},
	{
		page: '/settings/clinic/agent',
		pageLabel: 'Agent',
		section: 'Capabilities',
		search: { tab: 'tools' },
		title: 'Web search',
		description: 'Allow the agent to search the web for up-to-date information when answering questions.',
		keywords: ['internet', 'browse', 'fetch', 'online'],
	},
	{
		page: '/settings/clinic/agent',
		pageLabel: 'Agent',
		section: 'Capabilities',
		search: { tab: 'tools' },
		title: 'Saved Prompts',
		description: 'Save repeatable, customizable prompts for the agent to follow.',
		keywords: ['prompt template', 'instruction', 'preset'],
	},
	{
		page: '/settings/clinic/agent',
		pageLabel: 'Agent',
		section: 'Capabilities',
		search: { tab: 'tools' },
		title: 'Maps',
		description: 'Enable the agent to render query results on an interactive map.',
		keywords: ['display map', 'choropleth', 'points', 'scatter', 'bubble', 'geospatial'],
		adminOnly: true,
	},
	{
		page: '/settings/clinic/agent',
		pageLabel: 'Agent',
		section: 'Capabilities',
		search: { tab: 'tools' },
		title: 'GeoJSON Boundary Library',
		description: 'Add custom GeoJSON boundary sets the agent can use for choropleth maps.',
		keywords: ['geojson', 'boundaries', 'choropleth', 'map', 'regions', 'custom', 'polygon'],
		adminOnly: true,
	},

	{
		page: '/settings/clinic/agent',
		pageLabel: 'Agent',
		section: 'Display map',
		search: { tab: 'tools' },
		title: 'Display map',
		description: 'Allow the agent to render results with latitude and longitude columns on an interactive map.',
		keywords: ['map', 'geo', 'location', 'latitude', 'longitude', 'coordinates', 'spatial'],
	},

	// ── Users ───────────────────────────────────────────────
	{
		page: '/settings/users',
		pageLabel: 'Users',
		title: 'Users',
		description: 'Add users, change their role, and deactivate or reactivate them.',
		keywords: ['people', 'members', 'team', 'invite', 'add user', 'role', 'admin', 'viewer', 'deactivate'],
		adminOnly: true,
	},
	{
		page: '/settings/users',
		pageLabel: 'Users',
		title: 'Reset a user password',
		description: 'Give a user a one-time link to choose a new password.',
		keywords: ['password', 'reset', 'forgot', 'link', 'invite link', 'locked out'],
		adminOnly: true,
	},

	// ── Storage ─────────────────────────────────────────────
	{
		page: '/settings/storage',
		pageLabel: 'Storage',
		title: 'Permanent Storage',
		description:
			'Review the durable storage backend where the agent saves files: local disk, an S3 bucket, or disabled.',
		keywords: [
			'storage',
			'permanent',
			'persistent',
			'file',
			'files',
			'save',
			'write',
			'upload',
			'attachment',
			'disabled',
			'off',
			'bucket',
			's3',
			'minio',
			'r2',
			'volume',
			'disk',
			'local',
			'max file size',
			'size limit',
			'quota',
		],
		adminOnly: true,
		cloudHidden: true,
	},
	{
		page: '/settings/storage',
		pageLabel: 'Storage',
		title: 'Storage Health',
		description: 'Check that Loopwise can reach and write to the configured storage location.',
		keywords: ['health', 'status', 'reachable', 'connection', 'credentials', 'bucket access', 'writable'],
		adminOnly: true,
		cloudHidden: true,
	},
	{
		page: '/settings/storage',
		pageLabel: 'Storage',
		title: 'Storage Usage',
		description: 'See how many files are stored and how much space they take, for you or for every user.',
		keywords: [
			'usage',
			'stats',
			'statistics',
			'space',
			'size',
			'occupied',
			'files',
			'file count',
			'per user',
			'quota',
			'disk usage',
			'consumption',
			'my space',
		],
		cloudHidden: true,
	},

	// ── Clinic > Integrations & MCP ─────────────────────────

	// ── Clinic > Users & Groups ─────────────────────────────

	// ── Clinic > Automations ────────────────────────────────

	// ── Usage & Costs ──────────────────────────────────────────
	{
		page: '/settings/usage',
		pageLabel: 'Usage & Costs',
		title: 'Messages',
		description: 'How many messages have you sent?',
		keywords: ['usage', 'analytics', 'statistics'],
	},
	{
		page: '/settings/usage',
		pageLabel: 'Usage & Costs',
		title: 'Tokens',
		description: 'Tokens used by your chats.',
		keywords: ['token usage', 'input tokens', 'output tokens'],
	},
	{
		page: '/settings/usage',
		pageLabel: 'Usage & Costs',
		title: 'Cost',
		description: 'Estimated cost in USD based on token usage and model pricing.',
		keywords: ['price', 'billing', 'expense', 'spending'],
	},
	{
		page: '/settings/usage',
		pageLabel: 'Usage & Costs',
		title: 'Split per user',
		description: 'Break down messages, tokens and cost per user instead of per source or token category.',
		keywords: ['per user', 'by user', 'user breakdown', 'who spends', 'top users', 'split'],
		adminOnly: true,
	},

	// ── Usage & Costs > Chats Replay ─────────────────────────

	// ── Logs ─────────────────────────────────────────────────

	// ── Appearance > Branding ────────────────────────────────
];
