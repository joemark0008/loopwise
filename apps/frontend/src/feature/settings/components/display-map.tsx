import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import styles from './display-map.module.css';
import type { CustomBoundarySet } from '@quarry/shared';
import type { FeatureCollection } from 'geojson';
import { isDarkColorScheme } from '@/lib/color-scheme';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsCard } from '@/components/ui/settings-card';
import { SettingsControlRow } from '@/components/ui/settings-toggle-row';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from '@/hooks/use-map-style';
import { maplibregl } from '@/lib/maplibre';
import { cn } from '@/lib/utils';
import { projectApi } from '@/lib/project-api';

import 'maplibre-gl/dist/maplibre-gl.css';

interface SettingsDisplayMapProps {
	isAdmin: boolean;
}

export function SettingsDisplayMap({ isAdmin }: SettingsDisplayMapProps) {
	const queryClient = useQueryClient();
	const agentSettings = useQuery(projectApi.project.getAgentSettings.queryOptions());

	const updateAgentSettings = useMutation(
		projectApi.project.updateAgentSettings.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: projectApi.project.getAgentSettings.queryOptions().queryKey,
				});
			},
		}),
	);

	const displayMapEnabled = agentSettings.data?.mapEnabled ?? true;

	const handleDisplayMapChange = (enabled: boolean) => {
		updateAgentSettings.mutate({ mapEnabled: enabled });
	};

	return (
		<SettingsCard
			title='Maps'
			description='Allow the agent to render query results on an interactive map (web chat only).'
		>
			<SettingsControlRow
				id='display-map'
				label='Enable maps'
				description='Enables "points", "scatter_bubble" and "choropleth" map types for the agent.'
				control={
					<Switch
						id='display-map'
						checked={displayMapEnabled}
						onCheckedChange={handleDisplayMapChange}
						disabled={!isAdmin || updateAgentSettings.isPending}
					/>
				}
			/>
			<MapBoundariesLibrary isAdmin={isAdmin} />
		</SettingsCard>
	);
}

function MapBoundariesLibrary({ isAdmin }: { isAdmin: boolean }) {
	const [expandedKey, setExpandedKey] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<CustomBoundarySet | null>(null);

	const { data: boundaries = [], isLoading } = useQuery(projectApi.project.getMapBoundaries.queryOptions());

	const deleteMutation = useMutation(
		projectApi.project.deleteMapBoundary.mutationOptions({
			onSuccess: (next, _, __, ctx) => {
				ctx.client.setQueryData(projectApi.project.getMapBoundaries.queryKey(), next);
			},
		}),
	);

	const toggleExpanded = (key: string) => setExpandedKey((prev) => (prev === key ? null : key));

	const confirmDelete = () => {
		if (deleteTarget) {
			deleteMutation.mutate({ key: deleteTarget.key });
			setDeleteTarget(null);
		}
	};

	return (
		<div className={styles.mapBoundariesLibraryDiv}>
			<SettingsControlRow
				label='GeoJSON Boundary Library'
				description='Custom boundary sets the agent can use for choropleth maps.'
				control={
					isAdmin ? (
						<Button variant='secondary' size='sm' onClick={() => toggleExpanded('__new__')}>
							<Plus className={styles.mapBoundariesLibraryPlus} />
							Add
						</Button>
					) : null
				}
			/>

			{isLoading ? (
				<div className={styles.mapBoundariesLibraryDiv2}>Loading…</div>
			) : (
				<div className={styles.mapBoundariesLibraryDiv3}>
					{boundaries.length === 0 && expandedKey !== '__new__' && (
						<Empty>No custom boundary sets yet.</Empty>
					)}
					{boundaries.map((set) => (
						<BoundarySetItem
							key={set.key}
							set={set}
							isAdmin={isAdmin}
							isExpanded={expandedKey === set.key}
							onToggle={() => toggleExpanded(set.key)}
							onDelete={() => setDeleteTarget(set)}
							onSaved={() => setExpandedKey(null)}
						/>
					))}
					{expandedKey === '__new__' && (
						<BoundaryEditPanel
							editTarget={null}
							onClose={() => setExpandedKey(null)}
							onSaved={() => setExpandedKey(null)}
						/>
					)}
				</div>
			)}

			<AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete boundary set</AlertDialogTitle>
						<AlertDialogDescription>
							Remove <strong>{deleteTarget?.label}</strong> ({deleteTarget?.key}) from the library? Maps
							using this set will no longer display regions.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className={`${styles.mapBoundariesLibraryAlertDialogAction} text-destructive-foreground`}
							onClick={confirmDelete}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function BoundarySetItem({
	set,
	isAdmin,
	isExpanded,
	onToggle,
	onDelete,
	onSaved,
}: {
	set: CustomBoundarySet;
	isAdmin: boolean;
	isExpanded: boolean;
	onToggle: () => void;
	onDelete: () => void;
	onSaved: () => void;
}) {
	if (!isAdmin) {
		return (
			<div className={styles.boundarySetItemDiv}>
				<span className={styles.boundarySetItemSpan}>
					<span className={styles.boundarySetItemSpan2}>{set.label}</span>
					{set.featureCount != null && (
						<span className={styles.boundarySetItemSpan3}>{set.featureCount} features</span>
					)}
				</span>
			</div>
		);
	}

	return (
		<div className={styles.boundarySetItemDiv2}>
			<div className={styles.boundarySetItemDiv3}>
				<button type='button' onClick={onToggle} className={styles.boundarySetItemButton}>
					<span className={styles.boundarySetItemSpan4}>
						{isExpanded ? (
							<ChevronUp className={styles.boundarySetItemChevronUp} />
						) : (
							<ChevronDown className={styles.boundarySetItemChevronUp} />
						)}
					</span>
					<span className={styles.boundarySetItemSpan}>
						<span className={styles.boundarySetItemSpan2}>{set.label}</span>
						{set.featureCount != null && (
							<span className={styles.boundarySetItemSpan3}>{set.featureCount} features</span>
						)}
					</span>
				</button>
				<Button variant='ghost' size='icon' className={styles.boundarySetItemButton2} onClick={onDelete}>
					<Trash2 className={styles.boundarySetItemChevronUp} />
				</Button>
			</div>
			{isExpanded && <BoundaryEditPanel editTarget={set} onClose={onToggle} onSaved={onSaved} />}
		</div>
	);
}

function BoundaryEditPanel({
	editTarget,
	onClose,
	onSaved,
}: {
	editTarget: CustomBoundarySet | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const isEdit = editTarget !== null;

	const [url, setUrl] = useState('');
	const [label, setLabel] = useState('');
	const [key, setKey] = useState('');
	const [joinProperty, setJoinProperty] = useState('');
	const [regionKeyHint, setRegionKeyHint] = useState('');
	const [propertyKeys, setPropertyKeys] = useState<string[]>([]);
	const [previewGeojson, setPreviewGeojson] = useState<FeatureCollection | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [featureCount, setFeatureCount] = useState<number | undefined>(undefined);

	const validateMutation = useMutation(projectApi.project.validateMapBoundaryUrl.mutationOptions());
	const addMutation = useMutation(
		projectApi.project.addMapBoundary.mutationOptions({
			onSuccess: (next, _, __, ctx) => {
				ctx.client.setQueryData(projectApi.project.getMapBoundaries.queryKey(), next);
			},
		}),
	);
	const updateMutation = useMutation(
		projectApi.project.updateMapBoundary.mutationOptions({
			onSuccess: (next, _, __, ctx) => {
				ctx.client.setQueryData(projectApi.project.getMapBoundaries.queryKey(), next);
			},
		}),
	);

	const loadPreview = async (targetUrl: string) => {
		if (!targetUrl.trim()) {
			return;
		}
		setLoadError(null);
		setPreviewGeojson(null);
		try {
			const result = await validateMutation.mutateAsync({ url: targetUrl });
			setPropertyKeys(result.propertyKeys);
			setPreviewGeojson(result.geojson as FeatureCollection);
			setFeatureCount(result.featureCount);
			setJoinProperty((prev) => prev || (result.propertyKeys.length === 1 ? result.propertyKeys[0] : ''));
		} catch (err) {
			setLoadError(err instanceof Error ? err.message : 'Failed to load GeoJSON.');
		}
	};

	useEffect(() => {
		if (editTarget) {
			setUrl(editTarget.url);
			setLabel(editTarget.label);
			setKey(editTarget.key);
			setJoinProperty(editTarget.joinProperty);
			setRegionKeyHint(editTarget.regionKeyHint);
			setFeatureCount(editTarget.featureCount);
			setPropertyKeys([]);
			loadPreview(editTarget.url);
		} else {
			setUrl('');
			setLabel('');
			setKey('');
			setJoinProperty('');
			setRegionKeyHint('');
			setFeatureCount(undefined);
			setPropertyKeys([]);
			setPreviewGeojson(null);
			setLoadError(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editTarget]);

	const canSave =
		url.trim() !== '' &&
		label.trim() !== '' &&
		key.trim() !== '' &&
		joinProperty !== '' &&
		regionKeyHint.trim() !== '' &&
		(isEdit || previewGeojson !== null);

	const handleSave = async () => {
		if (!canSave) {
			return;
		}
		if (isEdit) {
			const newKey = key !== editTarget.key ? key : undefined;
			await updateMutation.mutateAsync({
				key: editTarget.key,
				newKey,
				label,
				url,
				joinProperty,
				regionKeyHint,
				featureCount,
			});
		} else {
			await addMutation.mutateAsync({ key, label, url, joinProperty, regionKeyHint, featureCount });
		}
		onSaved();
	};

	const isSaving = addMutation.isPending || updateMutation.isPending;

	return (
		<div
			className={cn(
				styles.boundaryEditPanelDiv,
				editTarget ? styles.boundaryEditPanelDiv2 : styles.boundaryEditPanelDiv3,
			)}
		>
			<Field label='GeoJSON URL'>
				<Input
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					onBlur={() => loadPreview(url)}
					placeholder='https://example.com/regions.geojson'
					disabled={validateMutation.isPending}
				/>
				{loadError && <p className={styles.boundaryEditPanelP}>{loadError}</p>}
				{validateMutation.isPending && <p className={styles.boundaryEditPanelP2}>Loading…</p>}
				{featureCount != null && propertyKeys.length > 1 && (
					<p className={styles.boundaryEditPanelP2}>
						{featureCount} features · {propertyKeys.length} properties
					</p>
				)}
			</Field>

			{previewGeojson && (
				<Field label='Preview'>
					<BoundaryPreviewMap geojson={previewGeojson} />
				</Field>
			)}

			<Field label='Label'>
				<Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder='French postal codes' />
			</Field>

			<Field
				label='Key'
				hint={
					<>
						Lowercase letters, digits and underscores only. This is the value the agent passes in{' '}
						<code className={styles.boundaryEditPanelCode}>region_boundaries</code>.
					</>
				}
			>
				<Input
					value={key}
					onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
					placeholder='french_postal_codes'
					className={styles.boundaryEditPanelCode}
				/>
			</Field>

			<Field
				label='Join property'
				hint={
					<>
						The GeoJSON feature property whose value must match the SQL{' '}
						<code className={styles.boundaryEditPanelCode}>region_key</code> column.
					</>
				}
			>
				<Select value={joinProperty} onValueChange={setJoinProperty} disabled={propertyKeys.length === 0}>
					<SelectTrigger>
						<SelectValue placeholder='Load a URL to see available properties…' />
					</SelectTrigger>
					<SelectContent>
						{propertyKeys.map((prop) => (
							<SelectItem key={prop} value={prop}>
								{prop}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>

			<Field
				label='Region key hint'
				hint={
					<>
						Explains to the agent what values to produce in the{' '}
						<code className={styles.boundaryEditPanelCode}>region_key</code> column, so it writes the right
						SQL.
					</>
				}
			>
				<Textarea
					value={regionKeyHint}
					onChange={(e) => setRegionKeyHint(e.target.value)}
					placeholder='5-digit French postal code (e.g. 75001 for Paris 1st)'
					rows={2}
				/>
			</Field>

			<div className={styles.boundaryEditPanelDiv4}>
				<Button variant='ghost' size='sm' onClick={onClose} disabled={isSaving}>
					Cancel
				</Button>
				<Button size='sm' onClick={handleSave} disabled={!canSave || isSaving}>
					{isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Add to library'}
				</Button>
			</div>
		</div>
	);
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
	return (
		<div className={styles.fieldDiv}>
			<p className={styles.fieldP}>{label}</p>
			{children}
			{hint && <p className={styles.boundaryEditPanelP2}>{hint}</p>}
		</div>
	);
}

function BoundaryPreviewMap({ geojson }: { geojson: FeatureCollection }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<maplibregl.Map | null>(null);

	const isDark = isDarkColorScheme();
	const styleUrl = isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		const map = new maplibregl.Map({
			container,
			style: styleUrl,
			attributionControl: false,
		});
		mapRef.current = map;

		map.on('load', () => {
			map.addSource('preview', { type: 'geojson', data: geojson });
			map.addLayer({
				id: 'preview-fill',
				type: 'fill',
				source: 'preview',
				paint: { 'fill-color': '#1F5FAE', 'fill-opacity': 0.25 },
			});
			map.addLayer({
				id: 'preview-line',
				type: 'line',
				source: 'preview',
				paint: { 'line-color': '#1F5FAE', 'line-width': 1, 'line-opacity': 0.7 },
			});

			const bounds = new maplibregl.LngLatBounds();
			let hasCoords = false;
			const extendBounds = (coords: unknown) => {
				if (!Array.isArray(coords)) {
					return;
				}
				if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
					bounds.extend([coords[0] as number, coords[1] as number]);
					hasCoords = true;
					return;
				}
				coords.forEach((c) => extendBounds(c));
			};
			for (const feature of geojson.features) {
				if (feature.geometry) {
					extendBounds((feature.geometry as { coordinates?: unknown }).coordinates);
				}
			}
			if (hasCoords && !bounds.isEmpty()) {
				map.fitBounds(bounds, { padding: 24, maxZoom: 14, duration: 0 });
			}
		});

		return () => {
			map.remove();
			mapRef.current = null;
		};
	}, [geojson, styleUrl]);

	return <div ref={containerRef} className={styles.boundaryPreviewMapDiv} />;
}
