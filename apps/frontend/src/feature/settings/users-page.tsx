import { useMutation, useQuery } from '@apollo/client/react';
import { useForm } from '@tanstack/react-form';
import { Check, Copy, KeyRound, MoreHorizontal, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import styles from './users-page.module.css';
import type { ManagedUserFieldsFragment } from '@/graphql/generated/graphql';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsCard, SettingsPageWrapper } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormTextField } from '@/feature/auth/components/auth-form';
import { validateSetupEmail, validateSetupName } from '@/feature/auth/setup-validation';
import {
	CreatePasswordLinkDocument,
	CreateUserDocument,
	ManagedUsersDocument,
	SetUserActiveDocument,
	UpdateUserRoleDocument,
} from '@/graphql/generated/graphql';
import { useSession } from '@/lib/auth-client';

type ManagedUser = ManagedUserFieldsFragment;

interface IssuedLink {
	user: ManagedUser;
	url: string;
	expiresAt: string;
	isInvite: boolean;
}

const ROLES = [
	{ value: 'admin', label: 'Admin', description: 'Manages users and every project.' },
	{ value: 'user', label: 'User', description: 'Chats and builds stories in every project.' },
	{ value: 'viewer', label: 'Viewer', description: 'Reads what others share.' },
];

const STATUS_LABEL: Record<ManagedUser['status'], string> = {
	ACTIVE: 'Active',
	INVITED: 'Invited',
	DEACTIVATED: 'Deactivated',
};

/** Organization admins create accounts here and hand out one-time links to set or reset passwords. */
export function UsersPage() {
	const { data: session } = useSession();
	const users = useQuery(ManagedUsersDocument);
	const [createOpen, setCreateOpen] = useState(false);
	const [issued, setIssued] = useState<IssuedLink | null>(null);
	const [deactivating, setDeactivating] = useState<ManagedUser | null>(null);
	const [actionError, setActionError] = useState<string>();

	const [createPasswordLink] = useMutation(CreatePasswordLinkDocument);
	const [updateUserRole] = useMutation(UpdateUserRoleDocument);
	const [setUserActive, { loading: isSettingActive }] = useMutation(SetUserActiveDocument);

	const run = async (action: () => Promise<unknown>) => {
		setActionError(undefined);
		try {
			await action();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : String(error));
		}
	};

	const issueLink = (user: ManagedUser) =>
		run(async () => {
			const { data } = await createPasswordLink({ variables: { userId: user.id } });
			if (data) {
				const link = data.createPasswordLink;
				setIssued({ ...link, isInvite: user.status === 'INVITED' });
			}
		});

	const list = users.data?.managedUsers ?? [];

	return (
		<SettingsPageWrapper>
			<div className={styles.usersPageHeader}>
				<h1 className={styles.usersPageH1}>Users</h1>
				<p className={styles.usersPageP}>
					Create accounts and give each person a one-time link to set their password. Nobody can sign up on
					their own.
				</p>
			</div>

			<SettingsCard
				title='People'
				description='Roles apply to every project unless a project sets its own.'
				action={
					<Button size='sm' variant='outline' onClick={() => setCreateOpen(true)}>
						<UserPlus className={styles.usersPageIcon} />
						Add user
					</Button>
				}
				flush
				divide
			>
				{users.loading && !users.data ? (
					<Skeleton className={styles.usersPageSkeleton} />
				) : users.error ? (
					<p className={styles.usersPageError}>{users.error.message}</p>
				) : (
					list.map((user) => (
						<UserRow
							key={user.id}
							user={user}
							isSelf={user.id === session?.user.id}
							onRoleChange={(role) =>
								run(() => updateUserRole({ variables: { input: { userId: user.id, role } } }))
							}
							onIssueLink={() => issueLink(user)}
							onDeactivate={() => setDeactivating(user)}
							onReactivate={() =>
								run(() => setUserActive({ variables: { userId: user.id, active: true } }))
							}
						/>
					))
				)}
			</SettingsCard>
			{actionError && <p className={styles.usersPageError}>{actionError}</p>}

			<CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void users.refetch()} />
			<PasswordLinkDialog link={issued} onClose={() => setIssued(null)} />
			<ConfirmationDialog
				open={deactivating !== null}
				onOpenChange={(open) => !open && setDeactivating(null)}
				title={`Deactivate ${deactivating?.name ?? 'user'}?`}
				description='They are signed out right away and cannot log in until you reactivate them. Their chats and stories are kept.'
				confirmLabel='Deactivate'
				isPending={isSettingActive}
				onConfirm={async () => {
					const user = deactivating;
					setDeactivating(null);
					if (user) {
						await run(() => setUserActive({ variables: { userId: user.id, active: false } }));
					}
				}}
			/>
		</SettingsPageWrapper>
	);
}

interface UserRowProps {
	user: ManagedUser;
	isSelf: boolean;
	onRoleChange: (role: string) => void;
	onIssueLink: () => void;
	onDeactivate: () => void;
	onReactivate: () => void;
}

function UserRow({ user, isSelf, onRoleChange, onIssueLink, onDeactivate, onReactivate }: UserRowProps) {
	const isDeactivated = user.status === 'DEACTIVATED';
	return (
		<div className={styles.userRow}>
			<div className={styles.userRowIdentity}>
				<span className={styles.userRowName}>
					{user.name}
					{isSelf && <span className={styles.userRowYou}> (you)</span>}
				</span>
				<span className={styles.userRowEmail}>{user.email}</span>
			</div>
			<Badge
				variant={user.status === 'ACTIVE' ? 'success' : user.status === 'INVITED' ? 'outline' : 'error'}
				className={styles.userRowStatus}
			>
				{STATUS_LABEL[user.status]}
			</Badge>
			<Select value={user.role} onValueChange={onRoleChange} disabled={isSelf || isDeactivated}>
				<SelectTrigger className={styles.userRowRole} aria-label={`Role of ${user.name}`}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{ROLES.map((role) => (
						<SelectItem key={role.value} value={role.value}>
							{role.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{isSelf ? (
				<span className={styles.userRowActionsPlaceholder} />
			) : (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant='ghost-muted' size='icon-sm' aria-label={`Actions for ${user.name}`}>
							<MoreHorizontal className={styles.usersPageIcon} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end'>
						{!isDeactivated && (
							<DropdownMenuItem onSelect={onIssueLink}>
								<KeyRound className={styles.usersPageIcon} />
								{user.status === 'INVITED' ? 'New invite link' : 'Reset password'}
							</DropdownMenuItem>
						)}
						{isDeactivated ? (
							<DropdownMenuItem onSelect={onReactivate}>
								<UserCheck className={styles.usersPageIcon} />
								Reactivate
							</DropdownMenuItem>
						) : (
							<DropdownMenuItem variant='destructive' onSelect={onDeactivate}>
								<UserX className={styles.usersPageIcon} />
								Deactivate
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}

interface CreateUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: () => void;
}

/** Creates the user, then shows their invite link in the same dialog. */
function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
	const [createUser] = useMutation(CreateUserDocument);
	const [role, setRole] = useState('user');
	const [serverError, setServerError] = useState<string>();
	const [created, setCreated] = useState<IssuedLink | null>(null);

	const form = useForm({
		defaultValues: { name: '', email: '' },
		onSubmit: async ({ value }) => {
			setServerError(undefined);
			try {
				const { data } = await createUser({
					variables: { input: { name: value.name.trim(), email: value.email.trim(), role } },
				});
				if (data) {
					setCreated({ ...data.createUser, isInvite: true });
					onCreated();
				}
			} catch (error) {
				setServerError(error instanceof Error ? error.message : String(error));
			}
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) {
					form.reset();
					setRole('user');
					setServerError(undefined);
					setCreated(null);
				}
				onOpenChange(next);
			}}
		>
			<DialogContent>
				{created ? (
					<PasswordLinkBody link={created} />
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Add user</DialogTitle>
							<DialogDescription>
								You get a link to send them. They choose their own password with it.
							</DialogDescription>
						</DialogHeader>
						<form
							className={styles.createUserForm}
							onSubmit={(e) => {
								e.preventDefault();
								e.stopPropagation();
								void form.handleSubmit();
							}}
						>
							<FormTextField
								form={form}
								name='name'
								title='Name'
								placeholder='Grace Hopper'
								autoComplete='off'
								validate={validateSetupName}
							/>
							<FormTextField
								form={form}
								name='email'
								type='email'
								title='Email'
								placeholder='grace@example.com'
								autoComplete='off'
								description='They log in with this address.'
								validate={validateSetupEmail}
							/>
							<div className={styles.createUserRole}>
								<label className={styles.createUserLabel} htmlFor='create-user-role'>
									Role
								</label>
								<Select value={role} onValueChange={setRole}>
									<SelectTrigger id='create-user-role'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ROLES.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className={styles.createUserHint}>
									{ROLES.find((option) => option.value === role)?.description}
								</p>
							</div>
							{serverError && <p className={styles.usersPageError}>{serverError}</p>}
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Button type='submit' variant='primary-gradient' disabled={isSubmitting}>
										{isSubmitting ? 'Creating…' : 'Create user'}
									</Button>
								)}
							</form.Subscribe>
						</form>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

/** A reset or new invite link. Keeps showing the last link while the dialog animates closed. */
function PasswordLinkDialog({ link, onClose }: { link: IssuedLink | null; onClose: () => void }) {
	const [shown, setShown] = useState(link);
	if (link && link !== shown) {
		setShown(link);
	}

	return (
		<Dialog open={link !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>{shown && <PasswordLinkBody link={shown} />}</DialogContent>
		</Dialog>
	);
}

function PasswordLinkBody({ link }: { link: IssuedLink }) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(link.url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard access can be refused; the link stays selectable in the field.
		}
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{link.isInvite ? 'Invite link' : 'Password reset link'}</DialogTitle>
				<DialogDescription>
					Send this link to {link.user.name} ({link.user.email}).{' '}
					{link.isInvite
						? 'They open it to choose their password.'
						: 'Their current password keeps working until they use it; then every session they have is signed out.'}{' '}
					It works once and expires on {new Date(link.expiresAt).toLocaleString()}. You will not see it again:
					it is only stored as a hash.
				</DialogDescription>
			</DialogHeader>
			<div className={styles.linkRow}>
				<Input
					readOnly
					value={link.url}
					className={styles.linkInput}
					aria-label='Password link'
					onFocus={(e) => e.currentTarget.select()}
				/>
				<Button variant='outline' onClick={copy}>
					{copied ? <Check className={styles.usersPageIcon} /> : <Copy className={styles.usersPageIcon} />}
					{copied ? 'Copied' : 'Copy'}
				</Button>
			</div>
		</>
	);
}
