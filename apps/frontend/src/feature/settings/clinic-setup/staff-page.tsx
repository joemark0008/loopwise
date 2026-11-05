import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STAFF_ROLE_LABELS } from '@loopwise/shared/staff-roles';
import { useMemo, useState } from 'react';
import styles from './clinic-setup.module.css';
import { LoadError } from './setup-form';
import type { StaffRole } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { useSession } from '@/lib/auth-client';
import { clinicSetupApi } from '@/lib/clinic-setup-api';

/** The desks and admin roles handed out per clinic (MEMBER and VIEWER come with the organization role). */
const DESK_ROLES: StaffRole[] = [
	'ADMIN',
	'SUPER_ADMIN',
	'DOCTOR',
	'NURSE',
	'MIDWIFE',
	'RECEPTIONIST',
	'CASHIER',
	'BILLING_CLERK',
	'PHARMACIST',
	'PHARMACY_ASSISTANT',
	'MEDTECH',
	'RADTECH',
	'INVENTORY_CLERK',
	'CONTEXT_ADMIN',
];

/**
 * Settings → Clinic → Staff: who works at this clinic, at which desks (`user_clinic_roles`). One row per user of the
 * organization, one column per role; ticking a box gives the role here. Accounts themselves are made in Settings →
 * Users. Nobody changes their own roles, and only a super admin hands out super admin.
 */
export function StaffPage() {
	const queryClient = useQueryClient();
	const clinic = useCurrentClinic();
	const { data: session } = useSession();
	const [search, setSearch] = useState('');
	const [onlyStaff, setOnlyStaff] = useState(true);
	const staff = useQuery(clinicSetupApi.staff.queryOptions({}));
	const setRoles = useMutation(
		clinicSetupApi.setStaffRoles.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries(clinicSetupApi.staff.pathFilter()),
		}),
	);
	const rows = useMemo(() => {
		const text = search.trim().toLowerCase();
		return (staff.data ?? []).filter(
			(user) =>
				(!onlyStaff || user.staffRoles.length > 0) &&
				(!text || user.name.toLowerCase().includes(text) || user.email.toLowerCase().includes(text)),
		);
	}, [staff.data, search, onlyStaff]);

	return (
		<SettingsCard
			title={`Staff of ${clinic.data?.name ?? 'this clinic'}`}
			description='Tick the desks each person works at here. Their sidebar and access follow these roles.'
		>
			<div className={styles.form}>
				<div className={styles.toolbarStart}>
					<Input
						className={styles.search}
						type='search'
						aria-label='Search staff'
						placeholder='Search by name or email'
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<label className={styles.checkboxRow}>
						<Checkbox checked={onlyStaff} onCheckedChange={setOnlyStaff} />
						Only people with a role here
					</label>
				</div>
				{setRoles.error && <ErrorMessage message={setRoles.error.message} />}
				{staff.error ? (
					<LoadError message={staff.error.message} onRetry={() => void staff.refetch()} />
				) : !staff.data ? (
					<Skeleton className={styles.form} />
				) : rows.length === 0 ? (
					<EmptyState title='Nobody here yet'>
						Clear the filter to give someone of the organization a role, or add users in Settings → Users.
					</EmptyState>
				) : (
					<div className={styles.tableScroll}>
						<table className={styles.table}>
							<thead>
								<tr>
									<th scope='col'>Person</th>
									{DESK_ROLES.map((role) => (
										<th key={role} scope='col'>
											{STAFF_ROLE_LABELS[role]}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.map((user) => {
									const isSelf = user.id === session?.user.id;
									return (
										<tr key={user.id} data-inactive={user.status === 'DEACTIVATED' || undefined}>
											<th scope='row'>
												{user.name}
												<div className={styles.muted}>
													{user.email}
													{isSelf && ' · you'}
												</div>
											</th>
											{DESK_ROLES.map((role) => {
												const checked = user.staffRoles.includes(role);
												return (
													<td key={role}>
														<Checkbox
															aria-label={`${STAFF_ROLE_LABELS[role]}: ${user.name}`}
															checked={checked}
															disabled={isSelf || setRoles.isPending}
															onCheckedChange={(next) =>
																setRoles.mutate({
																	userId: user.id,
																	staffRoles: next
																		? [...user.staffRoles, role]
																		: user.staffRoles.filter(
																				(current) => current !== role,
																			),
																})
															}
														/>
													</td>
												);
											})}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</SettingsCard>
	);
}
