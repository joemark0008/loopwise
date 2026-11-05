import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { DEFAULT_DATE_FORMAT_SETTINGS } from '@loopwise/shared/date';
import type { DateFormatSettings } from '@loopwise/shared/date';

import { clinicApi } from '@/lib/clinic-api';

/**
 * Returns the clinic's date format settings, falling back to the European
 * default while the query is loading or when no clinic is selected.
 */
export function useDateFormat(): DateFormatSettings {
	const { data } = useQuery(clinicApi.clinic.getDisplaySettings.queryOptions());
	return useMemo(() => data?.dateFormat ?? { ...DEFAULT_DATE_FORMAT_SETTINGS }, [data?.dateFormat]);
}
