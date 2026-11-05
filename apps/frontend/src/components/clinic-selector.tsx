import { USER_ROLE_LABELS } from '@loopwise/shared/types';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useState } from 'react';

import styles from './clinic-selector.module.css';
import type { UserRole } from '@loopwise/shared/types';

import { UpgradeToEnterprise } from '@/feature/settings/components/upgrade-to-enterprise';
import { CreateClinicDialog } from '@/feature/settings/components/create-clinic-dialog';
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
import { useMultiClinic } from '@/hooks/use-multi-clinic';
import { cn } from '@/lib/utils';

export type ClinicOption = {
	id: string;
	name: string;
	userRole: UserRole;
};

type ClinicSwitcherProps = {
	clinics: ClinicOption[];
	currentClinicId?: string;
	onChange: (clinicId: string) => void | Promise<boolean | void>;
	variant?: 'sidebar' | 'inline';
	className?: string;
};

export function ClinicSwitcher({
	clinics,
	currentClinicId,
	onChange,
	variant = 'sidebar',
	className,
}: ClinicSwitcherProps) {
	const currentClinic =
		clinics.find((clinic) => clinic.id === currentClinicId) ?? (clinics.length === 1 ? clinics[0] : null);

	if (variant === 'inline') {
		return (
			<InlineClinicSwitcher
				clinics={clinics}
				currentClinic={currentClinic}
				onChange={onChange}
				className={className}
			/>
		);
	}

	return (
		<SidebarClinicSwitcher
			clinics={clinics}
			currentClinic={currentClinic}
			onChange={onChange}
			className={className}
		/>
	);
}

function InlineClinicSwitcher({
	clinics,
	currentClinic,
	onChange,
	className,
}: Omit<ClinicSwitcherProps, 'currentClinicId' | 'variant'> & {
	currentClinic: ClinicOption | null;
}) {
	const mode = useMultiClinic();

	if (mode !== 'switch' || clinics.length <= 1 || !currentClinic) {
		return null;
	}

	return (
		<ClinicDropdown
			clinics={clinics}
			currentClinic={currentClinic}
			onChange={onChange}
			variant='inline'
			className={className}
			mode='switch'
		/>
	);
}

function SidebarClinicSwitcher({
	clinics,
	currentClinic,
	onChange,
	className,
}: Omit<ClinicSwitcherProps, 'currentClinicId' | 'variant'> & {
	currentClinic: ClinicOption | null;
}) {
	const mode = useMultiClinic();

	if (!currentClinic) {
		// loopwise: with no clinic left (e.g. all deleted), the switcher is the only way to create one.
		return mode === 'static' ? null : <NewClinicButton className={className} />;
	}

	if (mode === 'static') {
		return (
			<div className={cn(styles.sidebarClinicSwitcherDiv, className)}>
				<div className={getTriggerClassName('sidebar')}>
					<span className={styles.sidebarClinicSwitcherSpan}>{currentClinic.name}</span>
				</div>
			</div>
		);
	}

	return (
		<ClinicDropdown
			clinics={clinics}
			currentClinic={currentClinic}
			onChange={onChange}
			variant='sidebar'
			className={className}
			mode={mode}
		/>
	);
}

function ClinicDropdown({
	clinics,
	currentClinic,
	onChange,
	variant,
	className,
	mode,
}: Omit<ClinicSwitcherProps, 'currentClinicId' | 'variant'> & {
	currentClinic: ClinicOption;
	variant: 'sidebar' | 'inline';
	mode: 'switch' | 'upgrade';
}) {
	const [open, setOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const wrapperClassName = variant === 'sidebar' ? styles.sidebarClinicSwitcherDiv : styles.wrapperClassName;

	return (
		<div className={cn(wrapperClassName, className)}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type='button'
						aria-label={
							mode === 'upgrade'
								? `Clinic options. Current clinic: ${currentClinic.name}`
								: `Switch clinic. Current clinic: ${currentClinic.name}`
						}
						aria-expanded={open}
						className={cn(getTriggerClassName(variant), styles.clinicDropdownButton)}
					>
						<span className={styles.sidebarClinicSwitcherSpan}>{currentClinic.name}</span>
						<ChevronsUpDown className={styles.clinicDropdownChevronsUpDown} />
					</button>
				</PopoverTrigger>
				<PopoverContent
					align='start'
					className={cn(
						styles.clinicDropdownPopoverContent,
						variant === 'sidebar' && styles.clinicDropdownPopoverContent2,
					)}
				>
					<Command loop={mode !== 'upgrade'}>
						{mode !== 'upgrade' && clinics.length > 5 && <CommandInput placeholder='Search clinics...' />}
						<CommandList className={styles.clinicDropdownCommandList}>
							{mode === 'upgrade' ? (
								<CommandGroup>
									<ClinicUpgradeNudge />
								</CommandGroup>
							) : (
								<>
									<CommandEmpty>No clinics found.</CommandEmpty>
									<CommandGroup>
										{clinics.map((clinic) => (
											<CommandItem
												key={clinic.id}
												value={clinic.id}
												keywords={[clinic.name, USER_ROLE_LABELS[clinic.userRole]]}
												onSelect={() => {
													setOpen(false);
													void onChange(clinic.id);
												}}
											>
												<span className={styles.clinicDropdownSpan}>{clinic.name}</span>
												<span className={styles.clinicDropdownSpan2}>
													{USER_ROLE_LABELS[clinic.userRole]}
												</span>
												{clinic.id === currentClinic.id && (
													<Check className={styles.clinicDropdownCheck} />
												)}
											</CommandItem>
										))}
									</CommandGroup>
									<CommandSeparator />
									<CommandGroup>
										<CommandItem
											value='__new_project__'
											keywords={['new', 'create', 'clinic']}
											onSelect={() => {
												setOpen(false);
												setIsCreating(true);
											}}
										>
											<Plus className={styles.clinicDropdownPlus} />
											<span>New clinic</span>
										</CommandItem>
									</CommandGroup>
								</>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			<CreateClinicDialog open={isCreating} onOpenChange={setIsCreating} />
		</div>
	);
}

function NewClinicButton({ className }: { className?: string }) {
	const [isCreating, setIsCreating] = useState(false);

	return (
		<div className={cn(styles.sidebarClinicSwitcherDiv, className)}>
			<button
				type='button'
				className={cn(getTriggerClassName('sidebar'), styles.clinicDropdownButton)}
				onClick={() => setIsCreating(true)}
			>
				<span className={styles.sidebarClinicSwitcherSpan}>New clinic</span>
				<Plus className={styles.clinicDropdownChevronsUpDown} />
			</button>
			<CreateClinicDialog open={isCreating} onOpenChange={setIsCreating} />
		</div>
	);
}

function ClinicUpgradeNudge() {
	return (
		<div className={styles.clinicUpgradeNudgeDiv}>
			<div className={styles.clinicUpgradeNudgeDiv2}>
				<span className={styles.clinicUpgradeNudgeSpan}>Add more clinics</span>
				<UpgradeToEnterprise className={styles.clinicUpgradeNudgeUpgradeToEnterprise} />
			</div>
			<p className={styles.clinicUpgradeNudgeP}>Keep separate data contexts for different teams and use cases.</p>
		</div>
	);
}

function getTriggerClassName(variant: 'sidebar' | 'inline') {
	return cn(
		styles.getTriggerClassName,
		variant === 'sidebar' ? styles.getTriggerClassName2 : styles.getTriggerClassName3,
	);
}
