import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { DEFAULT_DATE_FORMAT_SETTINGS } from '@loopwise/shared/date';
import type { DateFormatSettings } from '@loopwise/shared/date';

import { projectApi } from '@/lib/project-api';

/**
 * Returns the project's date format settings, falling back to the European
 * default while the query is loading or when no project is selected.
 */
export function useDateFormat(): DateFormatSettings {
	const { data } = useQuery(projectApi.project.getDisplaySettings.queryOptions());
	return useMemo(() => data?.dateFormat ?? { ...DEFAULT_DATE_FORMAT_SETTINGS }, [data?.dateFormat]);
}
