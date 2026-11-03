import styles from './settings-toggle-row.module.css';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SettingsControlRowProps {
	label: string;
	description: string | React.ReactNode;
	control: React.ReactNode;
	id?: string;
	className?: string;
}

export function SettingsControlRow({ id, label, description, control, className }: SettingsControlRowProps) {
	return (
		<div className={cn(styles.settingsControlRowDiv, className)}>
			<div className={styles.settingsControlRowDiv2}>
				{id ? (
					<label htmlFor={id} className={styles.settingsControlRowLabel}>
						{label}
					</label>
				) : (
					<p className={styles.settingsControlRowP}>{label}</p>
				)}
				<div className={styles.settingsControlRowDiv3}>{description}</div>
			</div>
			{control}
		</div>
	);
}

interface SettingsToggleRowProps {
	id: string;
	label: string;
	description: string | React.ReactNode;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
	className?: string;
}

export function SettingsToggleRow({
	id,
	label,
	description,
	checked,
	onCheckedChange,
	disabled = false,
	className,
}: SettingsToggleRowProps) {
	return (
		<SettingsControlRow
			id={id}
			label={label}
			description={description}
			className={className}
			control={<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />}
		/>
	);
}
