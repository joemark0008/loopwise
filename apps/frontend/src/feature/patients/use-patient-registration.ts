import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toPatientDraftInput } from './patient-form-values';
import type { PatientFormValues } from './patient-form-values';
import type {
	PatientDuplicateFieldsFragment,
	PatientFieldsFragment,
	WiseOriginInput,
} from '@/graphql/generated/graphql';
import { patientApi } from '@/lib/patient-api';

export type RegistrationOutcome = 'registered' | 'linked';

/**
 * Registering a patient, for the register page and the Wise card alike: the first attempt stops at duplicates, which
 * the clinician then resolves by using the existing patient or (for a name match only) registering anyway. The Wise
 * card passes its `wiseOrigin`; both calls resolve to whether the patient was registered or linked.
 */
export function usePatientRegistration({
	onDone,
}: {
	onDone: (patient: PatientFieldsFragment, outcome: RegistrationOutcome) => void;
}) {
	const queryClient = useQueryClient();
	const [duplicates, setDuplicates] = useState<PatientDuplicateFieldsFragment[]>([]);
	const invalidate = () => queryClient.invalidateQueries(patientApi.patient.search.pathFilter());
	const register = useMutation(patientApi.patient.register.mutationOptions({ onSuccess: invalidate }));
	const link = useMutation(patientApi.patient.linkExisting.mutationOptions({ onSuccess: invalidate }));

	const submit = async (
		values: PatientFormValues,
		consentGiven: boolean,
		acknowledgeDuplicates = false,
		wiseOrigin?: WiseOriginInput,
	): Promise<boolean> => {
		const result = await register.mutateAsync({
			...toPatientDraftInput(values),
			consentGiven,
			acknowledgeDuplicates,
			...(wiseOrigin && { wiseOrigin }),
		});
		setDuplicates(result.duplicates);
		if (result.patient) {
			onDone(result.patient, 'registered');
			return true;
		}
		return false;
	};

	const linkExisting = async (
		values: PatientFormValues,
		consentGiven: boolean,
		patientId: string,
		wiseOrigin?: WiseOriginInput,
	): Promise<boolean> => {
		const patient = await link.mutateAsync({
			...toPatientDraftInput(values),
			consentGiven,
			patientId,
			...(wiseOrigin && { wiseOrigin }),
		});
		setDuplicates([]);
		onDone(patient, 'linked');
		return true;
	};

	return {
		submit: (...args: Parameters<typeof submit>) => submit(...args).catch(() => false),
		linkExisting: (...args: Parameters<typeof linkExisting>) => linkExisting(...args).catch(() => false),
		duplicates,
		clearDuplicates: () => setDuplicates([]),
		error: register.error ?? link.error,
		isPending: register.isPending || link.isPending,
	};
}
