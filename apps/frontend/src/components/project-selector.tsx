import { USER_ROLE_LABELS } from '@loopwise/shared/types';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useState } from 'react';

import styles from './project-selector.module.css';
import type { UserRole } from '@loopwise/shared/types';

import { UpgradeToEnterprise } from '@/feature/settings/components/upgrade-to-enterprise';
import { CreateProjectDialog } from '@/feature/settings/components/create-project-dialog';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMultiProject } from '@/hooks/use-multi-project';
import { cn } from '@/lib/utils';

export type ProjectOption = {
	id: string;
	name: string;
	userRole: UserRole;
};

type ProjectSwitcherProps = {
	projects: ProjectOption[];
	currentProjectId?: string;
	onChange: (projectId: string) => void | Promise<boolean | void>;
	variant?: 'sidebar' | 'inline';
	className?: string;
};

export function ProjectSwitcher({
	projects,
	currentProjectId,
	onChange,
	variant = 'sidebar',
	className,
}: ProjectSwitcherProps) {
	const currentProject =
		projects.find((project) => project.id === currentProjectId) ?? (projects.length === 1 ? projects[0] : null);

	if (variant === 'inline') {
		return (
			<InlineProjectSwitcher
				projects={projects}
				currentProject={currentProject}
				onChange={onChange}
				className={className}
			/>
		);
	}

	return (
		<SidebarProjectSwitcher
			projects={projects}
			currentProject={currentProject}
			onChange={onChange}
			className={className}
		/>
	);
}

function InlineProjectSwitcher({
	projects,
	currentProject,
	onChange,
	className,
}: Omit<ProjectSwitcherProps, 'currentProjectId' | 'variant'> & {
	currentProject: ProjectOption | null;
}) {
	const mode = useMultiProject();

	if (mode !== 'switch' || projects.length <= 1 || !currentProject) {
		return null;
	}

	return (
		<ProjectDropdown
			projects={projects}
			currentProject={currentProject}
			onChange={onChange}
			variant='inline'
			className={className}
			mode='switch'
		/>
	);
}

function SidebarProjectSwitcher({
	projects,
	currentProject,
	onChange,
	className,
}: Omit<ProjectSwitcherProps, 'currentProjectId' | 'variant'> & {
	currentProject: ProjectOption | null;
}) {
	const mode = useMultiProject();

	if (!currentProject) {
		// loopwise: with no project left (e.g. all deleted), the switcher is the only way to create one.
		return mode === 'static' ? null : <NewProjectButton className={className} />;
	}

	if (mode === 'static') {
		return (
			<div className={cn(styles.sidebarProjectSwitcherDiv, className)}>
				<div className={getTriggerClassName('sidebar')}>
					<span className={styles.sidebarProjectSwitcherSpan}>{currentProject.name}</span>
				</div>
			</div>
		);
	}

	return (
		<ProjectDropdown
			projects={projects}
			currentProject={currentProject}
			onChange={onChange}
			variant='sidebar'
			className={className}
			mode={mode}
		/>
	);
}

function ProjectDropdown({
	projects,
	currentProject,
	onChange,
	variant,
	className,
	mode,
}: Omit<ProjectSwitcherProps, 'currentProjectId' | 'variant'> & {
	currentProject: ProjectOption;
	variant: 'sidebar' | 'inline';
	mode: 'switch' | 'upgrade';
}) {
	const [open, setOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const wrapperClassName = variant === 'sidebar' ? styles.sidebarProjectSwitcherDiv : styles.wrapperClassName;

	return (
		<div className={cn(wrapperClassName, className)}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type='button'
						aria-label={
							mode === 'upgrade'
								? `Project options. Current project: ${currentProject.name}`
								: `Switch project. Current project: ${currentProject.name}`
						}
						aria-expanded={open}
						className={cn(getTriggerClassName(variant), styles.projectDropdownButton)}
					>
						<span className={styles.sidebarProjectSwitcherSpan}>{currentProject.name}</span>
						<ChevronsUpDown className={styles.projectDropdownChevronsUpDown} />
					</button>
				</PopoverTrigger>
				<PopoverContent
					align='start'
					className={cn(
						styles.projectDropdownPopoverContent,
						variant === 'sidebar' && styles.projectDropdownPopoverContent2,
					)}
				>
					<Command loop={mode !== 'upgrade'}>
						{mode !== 'upgrade' && projects.length > 5 && <CommandInput placeholder='Search projects...' />}
						<CommandList className={styles.projectDropdownCommandList}>
							{mode === 'upgrade' ? (
								<CommandGroup>
									<ProjectUpgradeNudge />
								</CommandGroup>
							) : (
								<>
									<CommandEmpty>No projects found.</CommandEmpty>
									<CommandGroup>
										{projects.map((project) => (
											<CommandItem
												key={project.id}
												value={project.id}
												keywords={[project.name, USER_ROLE_LABELS[project.userRole]]}
												onSelect={() => {
													setOpen(false);
													void onChange(project.id);
												}}
											>
												<span className={styles.projectDropdownSpan}>{project.name}</span>
												<span className={styles.projectDropdownSpan2}>
													{USER_ROLE_LABELS[project.userRole]}
												</span>
												{project.id === currentProject.id && (
													<Check className={styles.projectDropdownCheck} />
												)}
											</CommandItem>
										))}
									</CommandGroup>
									<CommandSeparator />
									<CommandGroup>
										<CommandItem
											value='__new_project__'
											keywords={['new', 'create', 'project']}
											onSelect={() => {
												setOpen(false);
												setIsCreating(true);
											}}
										>
											<Plus className={styles.projectDropdownPlus} />
											<span>New project</span>
										</CommandItem>
									</CommandGroup>
								</>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			<CreateProjectDialog open={isCreating} onOpenChange={setIsCreating} />
		</div>
	);
}

function NewProjectButton({ className }: { className?: string }) {
	const [isCreating, setIsCreating] = useState(false);

	return (
		<div className={cn(styles.sidebarProjectSwitcherDiv, className)}>
			<button
				type='button'
				className={cn(getTriggerClassName('sidebar'), styles.projectDropdownButton)}
				onClick={() => setIsCreating(true)}
			>
				<span className={styles.sidebarProjectSwitcherSpan}>New project</span>
				<Plus className={styles.projectDropdownChevronsUpDown} />
			</button>
			<CreateProjectDialog open={isCreating} onOpenChange={setIsCreating} />
		</div>
	);
}

function ProjectUpgradeNudge() {
	return (
		<div className={styles.projectUpgradeNudgeDiv}>
			<div className={styles.projectUpgradeNudgeDiv2}>
				<span className={styles.projectUpgradeNudgeSpan}>Add more projects</span>
				<UpgradeToEnterprise className={styles.projectUpgradeNudgeUpgradeToEnterprise} />
			</div>
			<p className={styles.projectUpgradeNudgeP}>
				Keep separate data contexts for different teams and use cases.
			</p>
		</div>
	);
}

function getTriggerClassName(variant: 'sidebar' | 'inline') {
	return cn(
		styles.getTriggerClassName,
		variant === 'sidebar' ? styles.getTriggerClassName2 : styles.getTriggerClassName3,
	);
}
