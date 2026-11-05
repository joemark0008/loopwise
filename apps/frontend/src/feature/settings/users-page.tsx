import { useMutation, useQuery } from '@apollo/client/react';
import { useForm } from '@tanstack/react-form';
import { STAFF_ROLE_LABELS, STAFF_ROLES } from '@loopwise/shared/staff-roles';
import { Check, ChevronDown, Copy, KeyRound, MoreHorizontal, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import styles from './users-page.module.css';
import type { ManagedUserFieldsFragment, StaffRole } from '@/graphql/generated/graphql';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
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
	SetUserStaffRolesDocument,
	UpdateUserRoleDocument,
} from '@/graphql/generated/graphql';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { useSession } from '@/lib/auth-client';

type ManagedUser = ManagedUserFieldsFragment;

interface IssuedLink {
	user: ManagedUser;
	url: string;
	expiresAt: string;
	isInvite: boolean;
}

const ROLES = [
	{ value: 'admin', label: 'Admin', description: 'Manages users and every clinic.' },
	{ value: 'user', label: 'User', description: 'Chats and builds stories in every clinic.' },
	{ value: 'viewer', label: 'Viewer', description: 'Reads what others share.' },
];

/**
 * The clinic roles an admin hands out (`user_clinic_roles`): they pick each person's desks. MEMBER and VIEWER are not
 * offered: the organization role above already gives that access.
 */
const CLINIC_ROLE_OPTIONS = STAFF_ROLES.filter((role) => role !== 'MEMBER' && role !== 'VIEWER') as StaffRole[];

const STATUS_LABEL: Record<ManagedUser['status'], string> = {
	ACTIVE: 'Active',
	INVITED: 'Invited',
	DEACTIVATED: 'Deactivated',
};

/** Organization admins create accounts here and hand out one-time links to set or reset passwords. */
export function UsersPage() {
	const { data: session } = useSession();
	const clinic = useCurrentClinic();
	const clinicName = clinic.data?.name;
	const users = useQuery(ManagedUsersDocument);
	const [createOpen, setCreateOpen] = useState(false);
	const [issued, setIssued] = useState<IssuedLink | null>(null);
	const [deactivating, setDeactivating] = useState<ManagedUser | null>(null);
	const [actionError, setActionError] = useState<string>();

	const [createPasswordLink] = useMutation(CreatePasswordLinkDocument);
	const [updateUserRole] = useMutation(UpdateUserRoleDocument);
	const [setUserStaffRoles] = useMutation(SetUserStaffRolesDocument);
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
				description={
					clinicName
						? `The role applies to every clinic. Clinic roles (doctor, nurse, cashier …) are those at ${clinicName}: they pick each person's desk.`
						: 'The role applies to every clinic.'
				}
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
							clinicName={clinicName}
							onRoleChange={(role) =>
								run(() => updateUserRole({ variables: { input: { userId: user.id, role } } }))
							}
							onStaffRolesChange={(staffRoles) =>
								run(() => setUserStaffRoles({ variables: { input: { userId: user.id, staffRoles } } }))
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

			<CreateUserDialog
				open={createOpen}
				clinicName={clinicName}
				onOpenChange={setCreateOpen}
				onCreated={() => void users.refetch()}
			/>
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
	clinicName?: string;
	onRoleChange: (role: string) => void;
	onStaffRolesChange: (staffRoles: StaffRole[]) => void;
	onIssueLink: () => void;
	onDeactivate: () => void;
	onReactivate: () => void;
}

function UserRow({
	user,
	isSelf,
	clinicName,
	onRoleChange,
	onStaffRolesChange,
	onIssueLink,
	onDeactivate,
	onReactivate,
}: UserRowProps) {
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
			{clinicName && (
				<StaffRolesPicker
					value={user.staffRoles}
					onChange={onStaffRolesChange}
					disabled={isSelf || isDeactivated}
					label={`Clinic roles of ${user.name} at ${clinicName}`}
				/>
			)}
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

/** A multi-select of clinic roles: a button with the chosen roles, a menu of checkboxes. */
function StaffRolesPicker({
	value,
	onChange,
	disabled,
	label,
}: {
	value: readonly StaffRole[];
	onChange: (staffRoles: StaffRole[]) => void;
	disabled?: boolean;
	label: string;
}) {
	const summary = value.length === 0 ? 'No clinic role' : value.map((role) => STAFF_ROLE_LABELS[role]).join(', ');
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='outline'
					size='sm'
					className={styles.staffRoles}
					disabled={disabled}
					aria-label={label}
					title={summary}
				>
					<span className={styles.staffRolesText}>{summary}</span>
					<ChevronDown className={styles.usersPageIcon} aria-hidden />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				{CLINIC_ROLE_OPTIONS.map((role) => (
					<DropdownMenuCheckboxItem
						key={role}
						checked={value.includes(role)}
						onSelect={(event) => event.preventDefault()}
						onCheckedChange={(checked) =>
							onChange(checked ? [...value, role] : value.filter((current) => current !== role))
						}
					>
						{STAFF_ROLE_LABELS[role]}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

interface CreateUserDialogProps {
	open: boolean;
	clinicName?: string;
	onOpenChange: (open: boolean) => void;
	onCreated: () => void;
}

/** Creates the user, then shows their invite link in the same dialog. */
function CreateUserDialog({ open, clinicName, onOpenChange, onCreated }: CreateUserDialogProps) {
	const [createUser] = useMutation(CreateUserDocument);
	const [role, setRole] = useState('user');
	const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);
	const [serverError, setServerError] = useState<string>();
	const [created, setCreated] = useState<IssuedLink | null>(null);

	const form = useForm({
		defaultValues: { name: '', email: '' },
		onSubmit: async ({ value }) => {
			setServerError(undefined);
			try {
				const { data } = await createUser({
					variables: {
						input: {
							name: value.name.trim(),
							email: value.email.trim(),
							role,
							...(clinicName && { staffRoles }),
						},
					},
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
					setStaffRoles([]);
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
							{clinicName && (
								<div className={styles.createUserRole}>
									<span className={styles.createUserLabel}>Clinic roles</span>
									<StaffRolesPicker
										value={staffRoles}
										onChange={setStaffRoles}
										label={`Clinic roles at ${clinicName}`}
									/>
									<p className={styles.createUserHint}>
										At {clinicName}. They pick the desk the person opens on (doctor, nurse, lab,
										front desk, cashier).
									</p>
								</div>
							)}
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
