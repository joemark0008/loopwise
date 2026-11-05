import { Injectable, Logger } from '@nestjs/common';
import { APIError, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins/bearer';

import { OrganizationsService } from '../clinical/clinics/organizations/organizations.service.js';
import { buildUsernameAllowlist } from '../common/utils/auth-utils.js';
import { memoizeUntilRejected } from '../common/utils/memoize-until-rejected.js';
import { uuidv7 } from '../common/uuid.js';
import { ConfigService } from '../config/config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEACTIVATED_ACCOUNT_MESSAGE } from '../users/account-status.js';
import { UserRepository } from '../users/user.repository.js';

export type AuthInstance = Awaited<ReturnType<AuthService['createAuthInstance']>>;
export type AuthSession = NonNullable<Awaited<ReturnType<AuthInstance['api']['getSession']>>>;
export type AuthUser = AuthSession['user'];

const GITLAB_DEFAULT_BASE_URL = 'https://gitlab.com';

interface GithubProfile {
	id: number;
	login: string;
	email: string | null;
	avatar_url: string;
	[key: string]: unknown;
}

interface GitlabProfile {
	id: number;
	username: string;
	name: string;
	email: string | null;
	avatar_url: string;
	[key: string]: unknown;
}

/**
 * Port of upstream `auth.ts`: the better-auth instance (email + password, Google, GitHub, GitLab),
 * on the Prisma adapter. Left out: the OAuth provider and JWT plugins (MCP server, Phase 7),
 * enterprise SSO (Microsoft, OIDC, SSO session expiry), cloud email verification and billing hooks.
 *
 * Like upstream, the instance is built lazily and rebuilt by `updateAuth()` when its inputs change
 * (Google settings are edited in the app).
 */
@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);
	private readonly instance = memoizeUntilRejected(() => this.createAuthInstance());

	constructor(
		private readonly config: ConfigService,
		private readonly prisma: PrismaService,
		private readonly users: UserRepository,
		private readonly organizations: OrganizationsService,
	) {}

	getAuth(): Promise<AuthInstance> {
		return this.instance.get();
	}

	async getSession(headers: Headers): Promise<AuthSession | null> {
		const auth = await this.getAuth();
		return auth.api.getSession({ headers });
	}

	updateAuth(): void {
		this.instance.reset();
	}

	private async createAuthInstance() {
		const { env } = this.config;
		const baseURL = env.BETTER_AUTH_URL;
		const githubAllowlist = buildUsernameAllowlist(env.GITHUB_ALLOWED_USERS);
		const gitlabAllowlist = buildUsernameAllowlist(env.GITLAB_ALLOWED_USERS);

		// Self-hosted reads the org-level Google credential, with the env as fallback.
		const googleConfig = await this.organizations.getGoogleConfig();

		const socialProviders: NonNullable<Parameters<typeof betterAuth>[0]['socialProviders']> = {};
		if (googleConfig.clientId && googleConfig.clientSecret) {
			socialProviders.google = {
				prompt: 'select_account',
				clientId: googleConfig.clientId,
				clientSecret: googleConfig.clientSecret,
			};
		}

		if (env.GITHUB_SSO && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
			socialProviders.github = {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
				getUserInfo: async (token) => {
					const res = await fetch('https://api.github.com/user', {
						headers: { Authorization: `Bearer ${token.accessToken}`, Accept: 'application/json' },
					});
					if (!res.ok) {
						throw new Error(`GitHub API error: ${res.status}`);
					}
					const profile = (await res.json()) as GithubProfile;
					const githubLogin = typeof profile.login === 'string' ? profile.login.toLowerCase() : undefined;

					if (githubAllowlist.size > 0 && (!githubLogin || !githubAllowlist.has(githubLogin))) {
						throw new APIError('FORBIDDEN', {
							message: 'Your GitHub account is not authorized to access this application.',
						});
					}

					return {
						user: {
							id: String(profile.id),
							name: profile.login,
							email: profile.email ?? `${profile.login}@users.noreply.github.com`,
							image: profile.avatar_url,
							emailVerified: true,
						},
						data: profile,
					};
				},
			};
		}

		if (env.GITLAB_SSO && env.GITLAB_CLIENT_ID && env.GITLAB_CLIENT_SECRET) {
			const gitlabBaseUrl = (env.GITLAB_BASE_URL ?? GITLAB_DEFAULT_BASE_URL).replace(/\/+$/, '');
			socialProviders.gitlab = {
				clientId: env.GITLAB_CLIENT_ID,
				clientSecret: env.GITLAB_CLIENT_SECRET,
				issuer: gitlabBaseUrl,
				getUserInfo: async (token) => {
					const res = await fetch(`${gitlabBaseUrl}/api/v4/user`, {
						headers: { Authorization: `Bearer ${token.accessToken}` },
					});
					if (!res.ok) {
						throw new Error(`GitLab API error: ${res.status}`);
					}
					const profile = (await res.json()) as GitlabProfile;
					const gitlabUsername =
						typeof profile.username === 'string' ? profile.username.toLowerCase() : undefined;

					if (gitlabAllowlist.size > 0 && (!gitlabUsername || !gitlabAllowlist.has(gitlabUsername))) {
						throw new APIError('FORBIDDEN', {
							message: 'Your GitLab account is not authorized to access this application.',
						});
					}

					const hostname = new URL(gitlabBaseUrl).hostname;
					return {
						user: {
							id: String(profile.id),
							name: profile.name || profile.username,
							email: profile.email ?? `${profile.username}@users.noreply.${hostname}`,
							image: profile.avatar_url,
							emailVerified: true,
						},
						data: profile,
					};
				},
			};
		}

		return betterAuth({
			secret: env.BETTER_AUTH_SECRET,
			baseURL,
			basePath: '/api/auth',
			// Models User / Account / Session / Verification (tables users, accounts, sessions, verifications); every id
			// is a uuid column, so better-auth's own ids are UUIDv7.
			database: prismaAdapter(this.prisma, { provider: 'postgresql' }),
			advanced: { database: { generateId: () => uuidv7() } },
			plugins: [bearer()],
			trustedOrigins: [baseURL, ...(this.config.isDev ? ['http://localhost:3000'] : [])],
			emailAndPassword: {
				enabled: env.ENABLE_USER_LOGIN === true,
				disableSignUp: true,
				sendResetPassword: async ({ user }) => {
					// Email delivery comes with the notifications module (Phase 5).
					this.logger.warn(`Password reset requested for ${user.email}, but email is not set up yet.`);
				},
				onPasswordReset: async ({ user }) => {
					if (!user.emailVerified) {
						await this.users.markEmailVerified(user.id);
					}
				},
			},
			socialProviders,
			account: {
				accountLinking: {
					enabled: true,
					trustedProviders: ['google', 'github', 'gitlab'],
				},
			},
			databaseHooks: {
				user: {
					create: {
						// Accounts come from the setup wizard and from admins, never from better-auth, which also
						// covers the first sign-in through a social provider.
						before: async () => {
							throw new APIError('FORBIDDEN', { message: 'signup_disabled' });
						},
					},
				},
				session: {
					create: {
						before: async (session) => {
							if (await this.users.isUserDeactivated(session.userId)) {
								throw new APIError('FORBIDDEN', { message: DEACTIVATED_ACCOUNT_MESSAGE });
							}
							return true;
						},
					},
				},
			},
			user: {
				additionalFields: {
					requiresPasswordReset: { type: 'boolean', defaultValue: false, input: false },
					messagingProviderCode: { type: 'string', required: false, input: false },
				},
			},
		});
	}
}
