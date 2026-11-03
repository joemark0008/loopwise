import styles from './visualization-skeleton.module.css';
import GraphLoaderAnimated from '@/components/icons/graph-loader-animated';
import { Skeleton } from '@/components/ui/skeleton';
import { TextShimmer } from '@/components/ui/text-shimmer';

export function VisualizationSkeleton({ label }: { label: string }) {
	return (
		<div className={styles.visualizationSkeletonDiv}>
			<Skeleton className={styles.visualizationSkeletonSkeleton} />
			<Skeleton className={styles.visualizationSkeletonSkeleton2}>
				<GraphLoaderAnimated className={styles.visualizationSkeletonGraphLoaderAnimated} />
				<TextShimmer text={label} />
			</Skeleton>
		</div>
	);
}
