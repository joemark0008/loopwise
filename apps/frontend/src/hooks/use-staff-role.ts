import { useQuery } from '@tanstack/react-query';

import type { StaffRole } from '@/lib/navigation';
import { patientApi } from '@/lib/patient-api';

/** Facility types whose staff work the order worklist instead of seeing patients. */
const LAB_FACILITY_TYPES = new Set(['lab', 'imaging']);

/** Lab staff: every facility the user works at is a lab or imaging center. */
export function staffRoleOf(facilities: readonly { type?: string | null }[]): StaffRole {
	if (facilities.length > 0 && facilities.every((facility) => LAB_FACILITY_TYPES.has(facility.type ?? ''))) {
		return 'lab';
	}
	return 'doctor';
}

/**
 * The signed-in user's role in the loop (DESIGN.md §1), which picks their home and sidebar. The API has no staff
 * role yet, so it is read from the facilities the user works at: staff of labs and imaging centers are `lab`, everyone
 * else a doctor (the nurse worklist, referral and dashboard features add theirs here).
 */
export function useStaffRole(): StaffRole {
	const facilities = useQuery(patientApi.patient.facilities.queryOptions(undefined, { staleTime: 5 * 60_000 }));
	return staffRoleOf(facilities.data ?? []);
}
