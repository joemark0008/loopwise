import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DuplicateAlert } from './duplicate-alert';
import { emptyPatientForm, validatePatientForm } from './patient-form-values';
import { PatientFields } from './patient-fields';
import { usePatientRegistration } from './use-patient-registration';
import styles from './patients.module.css';
import type { PatientFormValues } from './patient-form-values';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { patientApi } from '@/lib/patient-api';

/** Registers a patient at the clinician's facility (DESIGN.md §7): fields, consent, then duplicate checks. */
export function RegisterPatientPage() {
	const navigate = useNavigate();
	const facilities = useQuery(patientApi.patient.facilities.queryOptions());
	const [values, setValues] = useState<PatientFormValues>(emptyPatientForm());
	const [consentGiven, setConsentGiven] = useState(false);
	const [showErrors, setShowErrors] = useState(false);
	const registration = usePatientRegistration({
		onDone: (patient) => void navigate({ to: '/patients/$patientId', params: { patientId: patient.id } }),
	});

	const onlyFacility = facilities.data?.length === 1 ? facilities.data[0].id : undefined;
	useEffect(() => {
		if (onlyFacility) {
			setValues((current) => (current.facilityId ? current : { ...current, facilityId: onlyFacility }));
		}
	}, [onlyFacility]);

	const errors = validatePatientForm(values);
	const consentError = !consentGiven ? 'The patient must agree to be registered.' : undefined;
	const isValid = Object.keys(errors).length === 0 && !consentError;
	const summaryRef = useRef<HTMLDivElement>(null);
	const problems = [...Object.values(errors), consentError].filter(Boolean) as string[];

	const onSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		setShowErrors(true);
		if (isValid) {
			void registration.submit(values, consentGiven);
		} else {
			// The summary takes focus so a screen reader hears what to fix; each error also sits under its field.
			requestAnimationFrame(() => summaryRef.current?.focus());
		}
	};

	return (
		<div className={styles.patientsPage}>
			<Link to='/patients' className={styles.patientsBack}>
				<ArrowLeft />
				Patients
			</Link>
			<header className={styles.patientsHeader}>
				<div>
					<h1 className={styles.patientsTitle}>Register a patient</h1>
					<p className={styles.patientsSubtitle}>
						{facilities.data?.length === 1
							? `At ${facilities.data[0].name}. You become part of the patient's care team.`
							: "You become part of the patient's care team."}
					</p>
				</div>
			</header>

			{facilities.isPending ? (
				<Skeleton className={styles.patientsSkeleton} />
			) : facilities.data?.length === 0 ? (
				<ErrorMessage message='You are not a member of any facility, so you cannot register patients.' />
			) : (
				<form className={styles.patientsForm} onSubmit={onSubmit} noValidate>
					<p className={styles.patientsRequiredNote}>
						Fields marked <span aria-hidden>*</span>
						<span className='sr-only'>with an asterisk</span> are required.
					</p>
					{showErrors && problems.length > 0 && (
						<div ref={summaryRef} className={styles.patientsErrorSummary} role='alert' tabIndex={-1}>
							<p className={styles.patientsErrorSummaryTitle}>
								{problems.length === 1 ? 'One thing to fix' : `${problems.length} things to fix`}
							</p>
							<ul>
								{problems.map((problem) => (
									<li key={problem}>{problem}</li>
								))}
							</ul>
						</div>
					)}
					<PatientFields
						values={values}
						errors={showErrors ? errors : {}}
						facilities={facilities.data ?? []}
						onChange={(next) => {
							setValues(next);
							registration.clearDuplicates();
						}}
						disabled={registration.isPending}
					/>
					<label className={styles.patientsConsent}>
						<Checkbox
							checked={consentGiven}
							onCheckedChange={setConsentGiven}
							aria-describedby={showErrors && consentError ? 'consent-error' : undefined}
						/>
						<span>
							<strong>Consent</strong>
							<span aria-hidden> *</span>: the patient agrees to be registered and to have their results
							followed up by their care team.
						</span>
					</label>
					{showErrors && consentError && (
						<p id='consent-error' className={styles.patientsFieldError}>
							{consentError}
						</p>
					)}

					<DuplicateAlert
						duplicates={registration.duplicates}
						isPending={registration.isPending}
						onUseExisting={(patientId) => void registration.linkExisting(values, consentGiven, patientId)}
						onRegisterAnyway={() => void registration.submit(values, consentGiven, true)}
					/>
					{registration.error && <ErrorMessage message={registration.error.message} />}

					<div className={styles.patientsActions}>
						<Button variant='ghost-muted' asChild>
							<Link to='/patients'>Cancel</Link>
						</Button>
						<Button type='submit' disabled={registration.isPending || registration.duplicates.length > 0}>
							<UserPlus />
							Register patient
						</Button>
					</div>
				</form>
			)}
		</div>
	);
}
