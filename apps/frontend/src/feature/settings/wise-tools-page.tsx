import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { WISE_TOOL_CATEGORIES, WISE_TOOL_CATEGORY_LABELS, WISE_TOOL_KIND_LABELS } from '@loopwise/shared/wise-tools';
import { Lock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import styles from './wise-tools-page.module.css';
import type { WiseToolCategory, WiseToolKind } from '@loopwise/shared/wise-tools';
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
 * Settings → Wise tools (DESIGN.md §7.3): every tool Wise can use, by category. An organization's admins turn tools on
 * or off in their organization; everyone can turn a tool off for themselves. Locked tools have no switch, and nothing here
 * turns off the clinician's Confirm: Wise never saves anything by itself.
 */
export function WiseToolsPage() {
	const queryClient = useQueryClient();
	const { isAdmin: isWorkspaceAdmin } = usePermissions();
	const [organizationId, setOrganizationId] = useState<string | null>(null);
	const settings = useQuery(wiseToolsApi.settings.queryOptions({ organizationId }));
	const onSettled = () => void queryClient.invalidateQueries(wiseToolsApi.settings.pathFilter());
	const setOrganization = useMutation(wiseToolsApi.setOrganization.mutationOptions({ onSettled }));
	const setMine = useMutation(wiseToolsApi.setMine.mutationOptions({ onSettled }));

	const data = settings.data;
	const organization = data?.organizations.find((candidate) => candidate.id === data.organizationId);
	const isAdmin = !!organization?.isAdmin;
	const busy = setOrganization.isPending || setMine.isPending;
	const error = settings.error ?? setOrganization.error ?? setMine.error;

	return (
		<SettingsPageWrapper>
			<div className={styles.page}>
				<div className={styles.header}>
					<div>
						<h1 className={styles.title}>Wise tools</h1>
						<p className={styles.lead}>What Wise can do for you in chat.</p>
					</div>
					{data && data.organizations.length > 1 && (
						<Select value={data.organizationId ?? undefined} onValueChange={setOrganizationId}>
							<SelectTrigger className={styles.organizationSelect} aria-label='Organization'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{data.organizations.map((candidate) => (
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
				{organization && (
					<p className={styles.lead}>
						{isAdmin
							? `You administer ${organization.name}: its switch turns a tool on or off for everyone there.`
							: `${organization.name} sets which tools are on. You can turn tools off for yourself.`}
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
										organizationName={organization?.name}
										isAdmin={isAdmin}
										disabled={busy}
										onOrganizationChange={(enabled) =>
											data.organizationId &&
											setOrganization.mutate({
												organizationId: data.organizationId,
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
							<Link to='/settings/clinic/skills' className={styles.link}>
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
	organizationName,
	isAdmin,
	disabled,
	onOrganizationChange,
	onMineChange,
}: {
	tool: WiseToolRow;
	organizationName?: string;
	isAdmin: boolean;
	disabled: boolean;
	onOrganizationChange: (enabled: boolean) => void;
	onMineChange: (enabled: boolean) => void;
}) {
	const id = `wise-tool-${tool.name}`;
	const description = (
		<span className={styles.description}>
			<Badge variant='outline' className={styles.kind}>
				{WISE_TOOL_KIND_LABELS[tool.kind as WiseToolKind] ?? tool.kind}
			</Badge>
			{tool.summary}
			{!tool.locked && !tool.comingSoon && <StateLine tool={tool} organizationName={organizationName} />}
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
							checked={tool.organizationEnabled}
							disabled={disabled}
							onCheckedChange={onOrganizationChange}
							aria-label={`${tool.label} at ${organizationName ?? 'this organization'}`}
						/>
						Organization
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

function StateLine({ tool, organizationName }: { tool: WiseToolRow; organizationName?: string }) {
	let text: string;
	if (tool.enabled) {
		text = 'On';
	} else if (!tool.myEnabled) {
		text = 'Off · turned off by you';
	} else if (!tool.organizationEnabled) {
		text = `Off · turned off${organizationName ? ` at ${organizationName}` : ''}`;
	} else {
		text = 'Off';
	}
	if (tool.organizationEnabled !== tool.organizationDefault) {
		text += ' · changed from the default';
	}
	return <span className={styles.state}>{text}</span>;
}
