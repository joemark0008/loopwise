import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { WISE_TOOL_CATEGORIES, WISE_TOOL_CATEGORY_LABELS, WISE_TOOL_KIND_LABELS } from '@quarry/shared/wise-tools';
import { Lock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import styles from './wise-tools-page.module.css';
import type { WiseToolCategory, WiseToolKind } from '@quarry/shared/wise-tools';
import type { WiseToolRow } from '@/lib/wise-tools-api';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/ui/error-message';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsCard, SettingsPageWrapper } from '@/components/ui/settings-card';
import { SettingsControlRow } from '@/components/ui/settings-toggle-row';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/hooks/use-permissions';
import { wiseToolsApi } from '@/lib/wise-tools-api';

/**
 * Settings → Wise tools (DESIGN.md §9.4): every tool Wise can use, by category. A facility's admins turn tools on or
 * off at their facility; everyone can turn a tool off for themselves. Locked tools have no switch, and nothing here
 * turns off the clinician's Confirm: Wise never saves anything by itself.
 */
export function WiseToolsPage() {
	const queryClient = useQueryClient();
	const { isAdmin: isWorkspaceAdmin } = usePermissions();
	const [facilityId, setFacilityId] = useState<string | null>(null);
	const settings = useQuery(wiseToolsApi.settings.queryOptions({ facilityId }));
	const onSettled = () => void queryClient.invalidateQueries(wiseToolsApi.settings.pathFilter());
	const setFacility = useMutation(wiseToolsApi.setFacility.mutationOptions({ onSettled }));
	const setMine = useMutation(wiseToolsApi.setMine.mutationOptions({ onSettled }));

	const data = settings.data;
	const facility = data?.facilities.find((candidate) => candidate.id === data.facilityId);
	const isAdmin = !!facility?.isAdmin;
	const busy = setFacility.isPending || setMine.isPending;
	const error = settings.error ?? setFacility.error ?? setMine.error;

	return (
		<SettingsPageWrapper>
			<div className={styles.page}>
				<div className={styles.header}>
					<div>
						<h1 className={styles.title}>Wise tools</h1>
						<p className={styles.lead}>What Wise can do for you in chat.</p>
					</div>
					{data && data.facilities.length > 1 && (
						<Select value={data.facilityId ?? undefined} onValueChange={setFacilityId}>
							<SelectTrigger className={styles.facilitySelect} aria-label='Facility'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{data.facilities.map((candidate) => (
									<SelectItem key={candidate.id} value={candidate.id}>
										{candidate.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
				<p className={styles.confirmNote} role='note'>
					<ShieldCheck aria-hidden />
					Wise always asks you to confirm before anything is saved. This can&apos;t be turned off.
				</p>
				{facility && (
					<p className={styles.lead}>
						{isAdmin
							? `You administer ${facility.name}: its switch turns a tool on or off for everyone there.`
							: `${facility.name} sets which tools are on. You can turn tools off for yourself.`}
					</p>
				)}
				{error && <ErrorMessage message={error.message} />}
				{!data ? (
					<Skeleton className={styles.skeleton} />
				) : (
					WISE_TOOL_CATEGORIES.map((category) => {
						const rows = data.tools.filter((tool) => tool.category === category);
						return rows.length === 0 ? null : (
							<SettingsCard
								key={category}
								title={WISE_TOOL_CATEGORY_LABELS[category as WiseToolCategory]}
								divide
							>
								{rows.map((tool) => (
									<ToolRow
										key={tool.name}
										tool={tool}
										facilityName={facility?.name}
										isAdmin={isAdmin}
										disabled={busy}
										onFacilityChange={(enabled) =>
											data.facilityId &&
											setFacility.mutate({
												facilityId: data.facilityId,
												toolName: tool.name,
												enabled,
											})
										}
										onMineChange={(enabled) => setMine.mutate({ toolName: tool.name, enabled })}
									/>
								))}
							</SettingsCard>
						);
					})
				)}
				<SettingsCard title='Skills'>
					<p className={styles.lead}>
						Wise reads the workspace&apos;s skills (clinical guidelines and playbooks) through{' '}
						<strong>Use skills</strong>.{' '}
						{isWorkspaceAdmin ? (
							<Link to='/settings/project/skills' className={styles.link}>
								Manage skills
							</Link>
						) : (
							'A workspace admin manages them.'
						)}
					</p>
				</SettingsCard>
			</div>
		</SettingsPageWrapper>
	);
}

function ToolRow({
	tool,
	facilityName,
	isAdmin,
	disabled,
	onFacilityChange,
	onMineChange,
}: {
	tool: WiseToolRow;
	facilityName?: string;
	isAdmin: boolean;
	disabled: boolean;
	onFacilityChange: (enabled: boolean) => void;
	onMineChange: (enabled: boolean) => void;
}) {
	const id = `wise-tool-${tool.name}`;
	const description = (
		<span className={styles.description}>
			<Badge variant='outline' className={styles.kind}>
				{WISE_TOOL_KIND_LABELS[tool.kind as WiseToolKind] ?? tool.kind}
			</Badge>
			{tool.summary}
			{!tool.locked && !tool.comingSoon && <StateLine tool={tool} facilityName={facilityName} />}
		</span>
	);
	let control;
	if (tool.comingSoon) {
		control = <span className={styles.muted}>Coming soon</span>;
	} else if (tool.locked) {
		control = (
			<span className={styles.muted}>
				<Lock aria-hidden /> Always on
			</span>
		);
	} else {
		control = (
			<div className={styles.switches}>
				{isAdmin && (
					<label className={styles.switchLabel}>
						<Switch
							checked={tool.facilityEnabled}
							disabled={disabled}
							onCheckedChange={onFacilityChange}
							aria-label={`${tool.label} at ${facilityName ?? 'this facility'}`}
						/>
						Facility
					</label>
				)}
				<label className={styles.switchLabel}>
					<Switch
						id={id}
						checked={tool.myEnabled}
						disabled={disabled}
						onCheckedChange={onMineChange}
						aria-label={`${tool.label} in my chats`}
					/>
					Me
				</label>
			</div>
		);
	}
	return (
		<SettingsControlRow
			label={tool.label}
			description={description}
			control={control}
			className={tool.enabled || tool.locked ? undefined : styles.off}
		/>
	);
}

function StateLine({ tool, facilityName }: { tool: WiseToolRow; facilityName?: string }) {
	let text: string;
	if (tool.enabled) {
		text = 'On';
	} else if (!tool.myEnabled) {
		text = 'Off · turned off by you';
	} else if (!tool.facilityEnabled) {
		text = `Off · turned off${facilityName ? ` at ${facilityName}` : ''}`;
	} else {
		text = 'Off';
	}
	if (tool.facilityEnabled !== tool.facilityDefault) {
		text += ' · changed from the default';
	}
	return <span className={styles.state}>{text}</span>;
}
