import { buildMapPoints, MAX_MAP_POINTS, resolveMapConfig } from '@quarry/shared';
import { lazy, memo, Suspense, useMemo } from 'react';
import { McpAppHeader } from './mcp-app-header';
import { OpenInQuarryButton } from './open-in-quarry-button';
import styles from './map-app-view.module.css';
import type { CustomBoundarySet, MapPoint, McpMapEmbedStoredConfig } from '@quarry/shared';

import { Skeleton } from '@/components/ui/skeleton';

const MapView = lazy(() => import('@/feature/chat/components/tool-calls/display-map-view'));

interface MapAppViewProps {
	config: McpMapEmbedStoredConfig;
	data: Record<string, unknown>[];
	columns: string[];
	quarryUrl?: string;
	projectId?: string;
	customBoundaries?: CustomBoundarySet[];
}

export const MapAppView = memo(function MapAppView({
	config,
	data,
	quarryUrl,
	projectId,
	customBoundaries,
}: MapAppViewProps) {
	const resolvedConfig = useMemo(() => resolveMapConfig(data, config), [data, config]);
	const points = useMemo<MapPoint[]>(() => buildMapPoints(data, resolvedConfig), [data, resolvedConfig]);
	const visiblePoints = useMemo<MapPoint[]>(() => points.slice(0, MAX_MAP_POINTS), [points]);

	const isChoropleth = resolvedConfig.map_type === 'choropleth';
	const errorMessage = mapErrorMessage(resolvedConfig, points, isChoropleth);
	const isTruncated = !isChoropleth && points.length > MAX_MAP_POINTS;

	return (
		<div className={styles.mapAppViewDiv}>
			<McpAppHeader title={config.title}>
				{quarryUrl ? <OpenInQuarryButton url={quarryUrl} /> : null}
			</McpAppHeader>
			<div className={styles.mapAppViewDiv2}>
				<div className={styles.mapAppViewDiv3}>
					{errorMessage ? (
						<div className={styles.mapAppViewDiv4}>{errorMessage}</div>
					) : (
						<Suspense fallback={<Skeleton className={styles.mapAppViewSkeleton} />}>
							<MapView
								points={visiblePoints}
								rows={data}
								config={resolvedConfig}
								customBoundaries={customBoundaries}
								boundaryProjectId={projectId}
							/>
						</Suspense>
					)}
					{isTruncated && (
						<span className={styles.mapAppViewSpan}>
							Showing the first {MAX_MAP_POINTS.toLocaleString()} of {points.length.toLocaleString()}{' '}
							points.
						</span>
					)}
				</div>
			</div>
		</div>
	);
});

function mapErrorMessage(config: McpMapEmbedStoredConfig, points: MapPoint[], isChoropleth: boolean): string | null {
	if (isChoropleth) {
		return null;
	}
	if (config.latitude_key === config.longitude_key) {
		return 'Could not display the map because the latitude and longitude keys resolve to the same column.';
	}
	if (points.length === 0) {
		return 'Could not display the map because no rows contain valid coordinates.';
	}
	return null;
}
