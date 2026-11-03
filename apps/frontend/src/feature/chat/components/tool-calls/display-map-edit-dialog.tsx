import { DEFAULT_MARKER_COLOR, DEFAULT_MARKER_RADIUS } from '@loopwise/shared';
import { displayMap } from '@loopwise/shared/tools';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import styles from './display-map-edit-dialog.module.css';
import type { BoundarySource } from '@loopwise/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { resolveCssVariableColorHex } from '@/lib/css-color';

interface MapConfigEditDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	config: displayMap.Input;
	isSaving: boolean;
	onSave: (config: displayMap.Input) => Promise<void>;
	description: string;
	boundarySource?: BoundarySource | null;
}

export function MapConfigEditDialog({
	open,
	onOpenChange,
	config,
	isSaving,
	onSave,
	description,
	boundarySource,
}: MapConfigEditDialogProps) {
	const [draft, setDraft] = useState<displayMap.Input>(config);
	const [primaryHex, setPrimaryHex] = useState(DEFAULT_MARKER_COLOR);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setDraft(config);
			setPrimaryHex(resolvePrimaryHex());
			setError(null);
		}
	}, [open, config]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const parsed = displayMap.InputSchema.safeParse(draft);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? 'Invalid map configuration.');
			return;
		}

		try {
			await onSave(parsed.data);
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to update map.');
		}
	};

	const updateRadius = (value: string) => {
		const parsed = value.trim() === '' ? undefined : Number(value);
		setDraft((prev) => ({ ...prev, radius: Number.isFinite(parsed) ? parsed : undefined }));
	};

	const isBubble = draft.map_type === 'scatter_bubble';
	const isChoropleth = draft.map_type === 'choropleth';
	const showRadius = !(isChoropleth || isBubble);
	const colorLabel = isChoropleth ? 'Color scale' : isBubble ? 'Bubble' : 'Marker';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={styles.mapConfigEditDialogDialogContent}>
				<DialogHeader>
					<DialogTitle>Edit map</DialogTitle>
					<DialogDescription className={styles.mapConfigEditDialogDialogDescription}>
						{description}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className={styles.mapConfigEditDialogForm}>
					<div className={styles.mapConfigEditDialogDiv}>
						<label htmlFor='map-title' className={styles.mapConfigEditDialogLabel}>
							Title
						</label>
						<Input
							id='map-title'
							className={styles.mapConfigEditDialogInput}
							value={draft.title}
							onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
							placeholder='Map title'
						/>
					</div>

					{boundarySource && (
						<div className={styles.mapConfigEditDialogDiv}>
							<span className={styles.mapConfigEditDialogLabel}>GeoJSON boundaries</span>
							{boundarySource.kind === 'url' ? (
								<Input
									className={styles.mapConfigEditDialogInput2}
									value={draft.boundaries_url ?? ''}
									onChange={(e) =>
										setDraft((prev) => ({ ...prev, boundaries_url: e.target.value || undefined }))
									}
									placeholder='https://example.com/regions.geojson'
								/>
							) : (
								<div className={styles.mapConfigEditDialogDiv2}>
									<span className={styles.mapConfigEditDialogSpan}>{boundarySource.label}</span>
									<Badge variant='secondary'>{BOUNDARY_KIND_LABELS[boundarySource.kind]}</Badge>
								</div>
							)}
						</div>
					)}

					<div className={styles.mapConfigEditDialogDiv}>
						<span className={styles.mapConfigEditDialogLabel}>{colorLabel}</span>
						<div className={styles.mapConfigEditDialogDiv3}>
							<input
								type='color'
								aria-label={`${colorLabel} color`}
								value={draft.color ?? primaryHex}
								onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
								className={styles.mapConfigEditDialogInput3}
							/>
							{showRadius ? (
								<>
									<input
										type='range'
										aria-label={isBubble ? 'Largest bubble size' : 'Marker size'}
										min={3}
										max={30}
										value={draft.radius ?? DEFAULT_MARKER_RADIUS}
										onChange={(e) => updateRadius(e.target.value)}
										className={styles.mapConfigEditDialogInput4}
									/>
									<ArrowRight className={styles.mapConfigEditDialogArrowRight} />
									<MarkerPreview
										color={draft.color ?? primaryHex}
										radius={draft.radius ?? DEFAULT_MARKER_RADIUS}
									/>
								</>
							) : (
								<div className={styles.mapConfigEditDialogDiv4} />
							)}
							<Button
								type='button'
								variant='ghost'
								size='sm'
								className={styles.mapConfigEditDialogButton}
								onClick={() =>
									setDraft((prev) => ({
										...prev,
										color: undefined,
										...(showRadius && { radius: undefined }),
									}))
								}
								disabled={!draft.color && !(showRadius && draft.radius)}
							>
								Reset
							</Button>
						</div>
					</div>

					{error && <p className={styles.mapConfigEditDialogP}>{error}</p>}

					<DialogFooter>
						<Button
							type='button'
							variant='ghost'
							className={styles.mapConfigEditDialogButton2}
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							variant='primary-gradient'
							type='submit'
							className={styles.mapConfigEditDialogButton3}
							isLoading={isSaving}
							disabled={isSaving}
						>
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

const BOUNDARY_KIND_LABELS: Record<BoundarySource['kind'], string> = {
	builtin: 'Built-in',
	custom: 'Custom',
	inline: 'From query',
	url: 'From URL',
};

const MARKER_STROKE_WIDTH = 2;

function MarkerPreview({ color, radius }: { color: string; radius: number }) {
	const diameter = radius * 2 + MARKER_STROKE_WIDTH * 2;
	return (
		<div className={styles.markerPreviewDiv}>
			<span
				className={styles.markerPreviewSpan}
				style={{
					width: diameter,
					height: diameter,
					backgroundColor: color,
					opacity: 0.9,
					border: `${MARKER_STROKE_WIDTH}px solid var(--app-surface)`,
					boxSizing: 'border-box',
				}}
			/>
		</div>
	);
}

function resolvePrimaryHex(): string {
	return resolveCssVariableColorHex('--primary', DEFAULT_MARKER_COLOR);
}
