import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useMatchRoute, useRouterState } from '@tanstack/react-router';
import { ArrowLeft, Maximize2, MessageSquare, Minimize2, PanelRightClose, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import styles from './patient-layout.module.css';
import { PatientAgentProvider, PatientWisePanel, usePatientChat } from './patient-wise-panel';
import { useWiseLayout } from './use-wise-layout';
import { WiseSplitter } from './wise-splitter';
import type { ReactNode } from 'react';
import { PatientBanner } from '@/components/clinical/patient-banner';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { AllergyDialog } from '@/feature/encounters/allergy-dialog';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { PATIENT_TABS } from '@/lib/navigation';
import { patientApi } from '@/lib/patient-api';

/** Wise docks beside the chart from this width; below it, it opens over the page. */
const WIDE = '(min-width: 75.0625rem)';

/**
 * Every page of one patient (`/patients/:id/*`): the patient banner with allergies, the patient's pages, and the
 * patient's Wise chat docked beside them. The chart read is audited by the API.
 */
export function PatientLayout({ patientId }: { patientId: string }) {
	const patient = useQuery(patientApi.patient.get.queryOptions({ id: patientId }));
	const allergies = useQuery(encounterRecordApi.encounterRecord.allergies.queryOptions({ patientId }));
	const clinics = useQuery(patientApi.patient.clinics.queryOptions());
	const chat = usePatientChat(patientId);
	const matchRoute = useMatchRoute();
	const isEncounter = !!matchRoute({ to: '/patients/$patientId/encounters/$encounterId', params: { patientId } });
	const [isWiseOpen, setIsWiseOpen] = useState(false);
	const [isAllergyOpen, setIsAllergyOpen] = useState(false);
	const closeWiseRef = useRef<HTMLButtonElement>(null);
	const bodyRef = useRef<HTMLDivElement>(null);
	const wise = useWiseLayout();

	useEffect(() => {
		if (!isWiseOpen) {
			return;
		}
		// Opened over the page (below 75rem): focus goes into the panel, and Escape closes it.
		closeWiseRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setIsWiseOpen(false);
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [isWiseOpen]);

	// The chart chat is read before the pages mount, so its agent wraps them from the first render.
	if (patient.isPending || chat.isPending) {
		return (
			<div className={styles.state}>
				<Skeleton className={styles.skeleton} />
			</div>
		);
	}
	if (patient.error) {
		return (
			<div className={styles.state}>
				<ErrorMessage message={patient.error.message} />
				<Button variant='outline' size='sm' onClick={() => void patient.refetch()}>
					Retry
				</Button>
			</div>
		);
	}
	if (!patient.data) {
		return (
			<div className={styles.state}>
				<BackLinks />
				<Empty>This patient is not in your care, or does not exist.</Empty>
			</div>
		);
	}

	const withAgent = (body: ReactNode) =>
		chat.isSuccess ? (
			<PatientAgentProvider patientId={patientId} chatId={chat.data}>
				{body}
			</PatientAgentProvider>
		) : (
			body
		);
	// Allergies are kept by the staff of the patient's organization.
	const canRecordAllergy = !!clinics.data?.some((clinic) => clinic.organizationId === patient.data?.organizationId);
	return (
		<div
			className={styles.shell}
			data-wise-open={isWiseOpen || undefined}
			data-wise-mode={wise.mode}
			style={{ '--wise-width': `${wise.width}px` } as React.CSSProperties}
		>
			<div className={styles.header}>
				{!isEncounter && <BackLinks />}
				<PatientBanner
					patient={patient.data}
					allergies={allergies.data}
					onAddAllergy={canRecordAllergy ? () => setIsAllergyOpen(true) : undefined}
					actions={
						<Button
							variant='outline'
							className={styles.askWise}
							onClick={() =>
								// Wide screens bring the docked panel back; narrow ones open it over the page.
								window.matchMedia(WIDE).matches ? wise.setMode('docked') : setIsWiseOpen(true)
							}
							aria-expanded={isWiseOpen}
							aria-controls='patient-wise'
						>
							<Sparkles />
							Ask Wise
						</Button>
					}
				/>
			</div>
			{withAgent(
				<div className={styles.body} ref={bodyRef}>
					<div className={styles.main}>
						<div className={styles.inner}>
							{!isEncounter && <PatientTabs patientId={patientId} />}
							<Outlet />
						</div>
					</div>
					{wise.mode === 'docked' && (
						<WiseSplitter width={wise.width} onWidthChange={wise.setWidth} containerRef={bodyRef} />
					)}
					{wise.mode === 'collapsed' && (
						<button
							type='button'
							className={styles.wiseRail}
							onClick={() => wise.setMode('docked')}
							aria-controls='patient-wise'
							aria-expanded={false}
						>
							<Sparkles aria-hidden />
							<span>Wise</span>
						</button>
					)}
					<aside className={styles.wise} id='patient-wise' aria-label='Wise'>
						<div className={styles.wiseClose}>
							<Button
								ref={closeWiseRef}
								variant='ghost'
								size='icon'
								onClick={() => setIsWiseOpen(false)}
								aria-label='Close Wise'
							>
								<X />
							</Button>
						</div>
						<PatientWisePanel
							chatError={chat.error}
							actions={
								<span className={styles.wiseModeActions}>
									<Button
										variant='ghost'
										size='icon-sm'
										onClick={() => wise.setMode(wise.mode === 'expanded' ? 'docked' : 'expanded')}
										aria-label={
											wise.mode === 'expanded' ? 'Show the chart beside Wise' : 'Expand Wise'
										}
										aria-pressed={wise.mode === 'expanded'}
									>
										{wise.mode === 'expanded' ? <Minimize2 /> : <Maximize2 />}
									</Button>
									<Button
										variant='ghost'
										size='icon-sm'
										onClick={() => wise.setMode('collapsed')}
										aria-label='Collapse Wise'
									>
										<PanelRightClose />
									</Button>
								</span>
							}
						/>
					</aside>
				</div>,
			)}
			{canRecordAllergy && (
				<AllergyDialog patientId={patientId} open={isAllergyOpen} onOpenChange={setIsAllergyOpen} />
			)}
		</div>
	);
}

function BackLinks() {
	// Set when Wise opened the chart from a chat (`open_page`, or a `find_patient` row).
	const fromChatId = useRouterState({ select: (state) => state.location.state.fromChatId });
	return (
		<div className={styles.backLinks}>
			<Link to='/patients' className={styles.back}>
				<ArrowLeft />
				Patients
			</Link>
			{fromChatId && (
				<Link to='/$chatId' params={{ chatId: fromChatId }} className={styles.back}>
					<MessageSquare />
					Back to chat
				</Link>
			)}
		</div>
	);
}

/** The patient's pages: the chart (visits, details) and, as they land, the other areas' tabs. */
function PatientTabs({ patientId }: { patientId: string }) {
	return (
		<nav className={styles.tabs} aria-label='Patient record'>
			<Link
				to='/patients/$patientId'
				params={{ patientId }}
				className={styles.tab}
				activeOptions={{ exact: true }}
				activeProps={{ 'aria-current': 'page' }}
			>
				Overview
			</Link>
			{Object.entries(PATIENT_TABS).map(([segment, label]) => (
				<Link
					key={segment}
					to={`/patients/$patientId/${segment}` as '/patients/$patientId/results'}
					params={{ patientId }}
					className={styles.tab}
					activeProps={{ 'aria-current': 'page' }}
				>
					{label}
				</Link>
			))}
		</nav>
	);
}
