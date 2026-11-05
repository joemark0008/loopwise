import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './clinic-setup.module.css';
import { PractitionerDialogs } from './practitioner-dialogs';
import { calendarDate, DAY_SHORT, LoadError, manilaDateTime, peso } from './setup-form';
import type { PractitionerDialogState } from './practitioner-dialogs';
import type { ClinicPractitioner } from '@/lib/clinic-setup-api';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { SettingsCard } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { clinicSetupApi } from '@/lib/clinic-setup-api';

type Removal = { kind: 'schedule' | 'leave'; id: string; label: string };

/**
 * Settings → Clinic → Practitioners: who holds clinic here, their credentials (PRC, PTR, S2, PhilHealth PAN), room and
 * fee, weekly clinic hours and leaves. Booking reads the hours and leaves (`PractitionerScheduleService`).
 */
export function PractitionersPage() {
	const queryClient = useQueryClient();
	const practitioners = useQuery(clinicSetupApi.practitioners.queryOptions({}));
	const [dialog, setDialog] = useState<PractitionerDialogState | null>(null);
	const [removal, setRemoval] = useState<Removal | null>(null);
	const onSuccess = async () => {
		await queryClient.invalidateQueries(clinicSetupApi.practitioners.pathFilter());
		setRemoval(null);
	};
	const removeSchedule = useMutation(clinicSetupApi.removeSchedule.mutationOptions({ onSuccess }));
	const removeLeave = useMutation(clinicSetupApi.removeLeave.mutationOptions({ onSuccess }));
	const removing = removeSchedule.isPending || removeLeave.isPending;

	return (
		<div className={styles.cardList}>
			<div className={styles.toolbar}>
				<p className={styles.muted}>Practitioners who hold clinic here, with their hours and leaves.</p>
				<Button size='sm' onClick={() => setDialog({ kind: 'profile', practitioner: null })}>
					Add practitioner
				</Button>
			</div>
			{practitioners.error ? (
				<LoadError message={practitioners.error.message} onRetry={() => void practitioners.refetch()} />
			) : !practitioners.data ? (
				<Skeleton className={styles.form} />
			) : practitioners.data.length === 0 ? (
				<EmptyState title='No practitioners yet'>Add the doctors who hold clinic here.</EmptyState>
			) : (
				practitioners.data.map((entry) => (
					<PractitionerCard
						key={entry.practitioner.id}
						entry={entry}
						onOpen={setDialog}
						onRemove={setRemoval}
					/>
				))
			)}
			<PractitionerDialogs state={dialog} onClose={() => setDialog(null)} />
			<ConfirmationDialog
				open={removal !== null}
				onOpenChange={(open) => !open && setRemoval(null)}
				title={removal?.kind === 'leave' ? 'Remove this leave?' : 'Remove these clinic hours?'}
				description={removal?.label ?? ''}
				confirmLabel='Remove'
				isPending={removing}
				error={(removeSchedule.error ?? removeLeave.error)?.message}
				onConfirm={() => {
					if (removal?.kind === 'leave') {
						removeLeave.mutate({ id: removal.id });
					} else if (removal) {
						removeSchedule.mutate({ id: removal.id });
					}
				}}
			/>
		</div>
	);
}

function PractitionerCard({
	entry,
	onOpen,
	onRemove,
}: {
	entry: ClinicPractitioner;
	onOpen: (state: PractitionerDialogState) => void;
	onRemove: (removal: Removal) => void;
}) {
	const { practitioner } = entry;
	const sessions = [...entry.schedules].sort(
		(a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
	);
	const credential = (label: string, number: string | null | undefined, expiry: string | null | undefined) =>
		number ? `${label} ${number}${expiry ? ` (until ${calendarDate(expiry)})` : ''}` : null;

	return (
		<section aria-label={practitioner.displayName}>
			<SettingsCard
				title={practitioner.displayName}
				description={[
					practitioner.specialty,
					entry.roomName,
					entry.consultFee != null ? peso(entry.consultFee) : null,
				]
					.filter(Boolean)
					.join(' · ')}
				action={
					<div className={styles.chips}>
						{!entry.isActive && <ClinicalFlag tone='void'>Not holding clinic here</ClinicalFlag>}
						{!practitioner.isActive && <ClinicalFlag tone='void'>Inactive</ClinicalFlag>}
						{!practitioner.userId && <ClinicalFlag tone='info'>Visiting (no account)</ClinicalFlag>}
					</div>
				}
			>
				<div className={styles.form}>
					<p className={styles.muted}>
						{[
							credential('PRC', practitioner.prcLicenseNo, practitioner.prcLicenseExpiry),
							credential('PTR', practitioner.ptrNo, null),
							credential('S2', practitioner.s2LicenseNo, practitioner.s2LicenseExpiry),
							credential('PhilHealth PAN', practitioner.philhealthPan, practitioner.philhealthPanExpiry),
						]
							.filter(Boolean)
							.join(' · ')}
					</p>
					<div>
						<h3 className={styles.subheading}>Clinic hours</h3>
						{sessions.length === 0 ? (
							<p className={styles.muted}>No weekly hours yet.</p>
						) : (
							<ul className={styles.list} aria-label={`Clinic hours of ${practitioner.displayName}`}>
								{sessions.map((session) => {
									const label = `${DAY_SHORT[session.dayOfWeek]} ${session.startTime}–${session.endTime}`;
									return (
										<li key={session.id} className={styles.listItem}>
											<span>
												{label} · {session.slotMinutes}-minute slots
												{session.maxPatients != null &&
													` · up to ${session.maxPatients} patients`}
											</span>
											<Button
												variant='ghost'
												size='sm'
												aria-label={`Remove ${label}`}
												onClick={() => onRemove({ kind: 'schedule', id: session.id, label })}
											>
												Remove
											</Button>
										</li>
									);
								})}
							</ul>
						)}
					</div>
					<div>
						<h3 className={styles.subheading}>Leaves</h3>
						{entry.leaves.length === 0 ? (
							<p className={styles.muted}>No leave coming up.</p>
						) : (
							<ul className={styles.list} aria-label={`Leaves of ${practitioner.displayName}`}>
								{entry.leaves.map((leave) => {
									const label = `${manilaDateTime(leave.startAt)} – ${manilaDateTime(leave.endAt)}`;
									return (
										<li key={leave.id} className={styles.listItem}>
											<span>
												{label}
												{leave.reason && ` · ${leave.reason}`}
											</span>
											<Button
												variant='ghost'
												size='sm'
												aria-label={`Remove leave ${label}`}
												onClick={() => onRemove({ kind: 'leave', id: leave.id, label })}
											>
												Remove
											</Button>
										</li>
									);
								})}
							</ul>
						)}
					</div>
					<div className={styles.actions}>
						<Button variant='outline' size='sm' onClick={() => onOpen({ kind: 'profile', practitioner })}>
							Edit profile
						</Button>
						<Button variant='outline' size='sm' onClick={() => onOpen({ kind: 'link', entry })}>
							Room and fee
						</Button>
						<Button variant='outline' size='sm' onClick={() => onOpen({ kind: 'leave', entry })}>
							Add leave
						</Button>
						<Button variant='outline' size='sm' onClick={() => onOpen({ kind: 'schedule', entry })}>
							Add hours
						</Button>
					</div>
				</div>
			</SettingsCard>
		</section>
	);
}
