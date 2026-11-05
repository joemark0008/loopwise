import { useQuery } from '@apollo/client/react';
import type { UserRole } from '@loopwise/shared/types';

import type { ClinicSummaryFieldsFragment } from '@/graphql/generated/graphql';
import { CurrentClinicDocument, ClinicsDocument } from '@/graphql/generated/graphql';
import { apolloClient } from '@/lib/apollo-client';

export type ClinicSummary = Omit<ClinicSummaryFieldsFragment, 'userRole' | '__typename'> & { userRole: UserRole };

const toClinic = (clinic: ClinicSummaryFieldsFragment): ClinicSummary => ({
	...clinic,
	userRole: clinic.userRole as UserRole,
});

/** The selected clinic from apps/api (`currentClinic`), shaped like upstream's `clinic.getCurrent`. */
export function useCurrentClinic({ skip = false }: { skip?: boolean } = {}) {
	const { data, loading, error, refetch } = useQuery(CurrentClinicDocument, { skip });
	const clinic = data ? (data.currentClinic ? toClinic(data.currentClinic) : null) : undefined;
	return {
		data: clinic,
		isLoading: loading && !data,
		isPending: !data,
		isFetching: loading,
		isSuccess: data !== undefined,
		isError: error !== undefined,
		error,
		refetch,
	};
}

/** Clinics the user can access (`clinics`), shaped like upstream's `clinic.listForCurrentUser`. */
export function useClinics({ skip = false }: { skip?: boolean } = {}) {
	const { data, loading, error, refetch } = useQuery(ClinicsDocument, { skip });
	return {
		data: data?.clinics.map(toClinic),
		isLoading: loading && !data,
		isPending: !data,
		isFetching: loading,
		isSuccess: data !== undefined,
		isError: error !== undefined,
		error,
		refetch,
	};
}

/** Outside React (route loaders): the selected clinic, from the Apollo cache when present. */
export async function fetchCurrentClinic(): Promise<ClinicSummary | null> {
	const { data } = await apolloClient.query({ query: CurrentClinicDocument });
	return data?.currentClinic ? toClinic(data.currentClinic) : null;
}

/** Re-reads the clinic queries after a clinic is created, renamed, deleted or switched. */
export async function refetchClinicQueries(): Promise<void> {
	await apolloClient.refetchQueries({ include: [CurrentClinicDocument, ClinicsDocument] });
}
