import { colorToHex, DEFAULT_THRESHOLD_COLOR } from '@quarry/shared/conditional-formatting';
import { getFormattableColumnType } from '@quarry/shared/story-table-utils';
import { useMemo, useState } from 'react';
import styles from './display-table-edit-dialog.module.css';
import type {
	ColumnConditionalFormats,
	ConditionalFormatRule,
	StringOperator,
	StringRule,
	ThresholdOperator,
} from '@quarry/shared/conditional-formatting';
import type { FormattableColumnType } from '@quarry/shared/story-table-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type RuleKind = 'none' | 'color-scale' | 'threshold' | 'boolean' | 'string';

const RULE_KIND_LABELS: Record<Exclude<RuleKind, 'none'>, string> = {
	'color-scale': 'Color scale',
	threshold: 'Threshold',
	boolean: 'Boolean',
	string: 'String',
};

const RULE_KINDS_BY_TYPE: Record<FormattableColumnType, Exclude<RuleKind, 'none'>[]> = {
	numeric: ['color-scale', 'threshold'],
	boolean: ['boolean'],
	string: ['string'],
};

const OPERATOR_OPTIONS: { value: ThresholdOperator; label: string }[] = [
	{ value: '>=', label: '≥' },
	{ value: '>', label: '>' },
	{ value: '<=', label: '≤' },
	{ value: '<', label: '<' },
	{ value: '=', label: '=' },
];

const STRING_OPERATOR_OPTIONS: { value: StringOperator; label: string }[] = [
	{ value: 'equals', label: 'equals' },
	{ value: 'in', label: 'in list' },
	{ value: 'like', label: 'contains' },
];

const DEFAULT_THRESHOLD_HEX = '#22c55e';
const DEFAULT_SCALE_HEX = '#3b82f6';
const DEFAULT_TRUE_COLOR = 'rgba(34, 197, 94, 0.32)';
const DEFAULT_FALSE_COLOR = 'rgba(239, 68, 68, 0.32)';
const DEFAULT_TRUE_HEX = '#22c55e';
const DEFAULT_FALSE_HEX = '#ef4444';

interface TableFormatEditDialogProps extends Omit<TableFormatEditFormProps, 'onCancel' | 'onSaved'> {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	description?: string;
}

/** Presentational dialog for editing per-column conditional formatting. */
export function TableFormatEditDialog({
	open,
	onOpenChange,
	description = 'Apply conditional formatting to table columns.',
	...form
}: TableFormatEditDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={styles.tableFormatEditDialogDialogContent}>
				<DialogHeader>
					<DialogTitle>Edit table formatting</DialogTitle>
					<DialogDescription className={styles.tableFormatEditDialogDialogDescription}>
						{description}
					</DialogDescription>
				</DialogHeader>
				{open && (
					<TableFormatEditForm
						{...form}
						onCancel={() => onOpenChange(false)}
						onSaved={() => onOpenChange(false)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

interface TableFormatEditFormProps {
	columns: string[];
	data: Record<string, unknown>[];
	formats: ColumnConditionalFormats;
	onSave: (next: ColumnConditionalFormats) => Promise<void>;
	isSaving?: boolean;
	onCancel: () => void;
	onSaved: () => void;
}

export function TableFormatEditForm({
	columns,
	data,
	formats,
	onSave,
	isSaving = false,
	onCancel,
	onSaved,
}: TableFormatEditFormProps) {
	const [draft, setDraft] = useState<ColumnConditionalFormats>(formats);
	const [error, setError] = useState<string | null>(null);

	const formattableColumns = useMemo(
		() =>
			columns
				.map((column) => ({ column, type: getFormattableColumnType(data, column) }))
				.filter((entry): entry is { column: string; type: FormattableColumnType } => entry.type !== null),
		[columns, data],
	);

	const setColumnRule = (column: string, rule: ConditionalFormatRule | undefined) => {
		setDraft((prev) => {
			const next = { ...prev };
			if (rule) {
				next[column] = rule;
			} else {
				delete next[column];
			}
			return next;
		});
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		try {
			await onSave(draft);
			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to update formatting.');
		}
	};

	return (
		<form onSubmit={handleSubmit} className={styles.tableFormatEditFormForm}>
			{formattableColumns.length === 0 ? (
				<p className={styles.tableFormatEditFormP}>No columns available to format.</p>
			) : (
				formattableColumns.map(({ column, type }) => (
					<ColumnRuleRow
						key={column}
						column={column}
						columnType={type}
						rule={draft[column]}
						onChange={(rule) => setColumnRule(column, rule)}
					/>
				))
			)}

			{error && <p className={styles.tableFormatEditFormP2}>{error}</p>}

			<DialogFooter>
				<Button type='button' variant='ghost' className={styles.tableFormatEditFormButton} onClick={onCancel}>
					Cancel
				</Button>
				<Button
					variant='primary-gradient'
					type='submit'
					className={styles.tableFormatEditFormButton2}
					isLoading={isSaving}
					disabled={isSaving}
				>
					Save
				</Button>
			</DialogFooter>
		</form>
	);
}

interface ColumnRuleRowProps {
	column: string;
	columnType: FormattableColumnType;
	rule: ConditionalFormatRule | undefined;
	onChange: (rule: ConditionalFormatRule | undefined) => void;
}

function ColumnRuleRow({ column, columnType, rule, onChange }: ColumnRuleRowProps) {
	const kind: RuleKind = rule?.type ?? 'none';
	const availableKinds = RULE_KINDS_BY_TYPE[columnType];

	const handleKindChange = (value: RuleKind) => {
		onChange(defaultRuleForKind(value));
	};

	return (
		<div className={styles.columnRuleRowDiv}>
			<div className={styles.columnRuleRowDiv2}>
				<span className={styles.columnRuleRowSpan}>{column}</span>
				<Select value={kind} onValueChange={(value) => handleKindChange(value as RuleKind)}>
					<SelectTrigger className={styles.columnRuleRowSelectTrigger}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent className={styles.columnRuleRowSelectContent}>
						<SelectItem value='none'>None</SelectItem>
						{availableKinds.map((option) => (
							<SelectItem key={option} value={option}>
								{RULE_KIND_LABELS[option]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{rule?.type === 'color-scale' && (
				<div className={styles.columnRuleRowDiv3}>
					<span className={styles.columnRuleRowSpan2}>Color</span>
					<ColorSwatch
						ariaLabel={`Color scale color for ${column}`}
						value={toHexColor(rule.color ?? rule.maxColor ?? rule.minColor, DEFAULT_SCALE_HEX)}
						onChange={(color) => onChange({ type: 'color-scale', color, min: rule.min, max: rule.max })}
					/>
				</div>
			)}

			{rule?.type === 'threshold' && (
				<div className={styles.columnRuleRowDiv3}>
					<Select
						value={rule.operator}
						onValueChange={(operator) => onChange({ ...rule, operator: operator as ThresholdOperator })}
					>
						<SelectTrigger className={styles.columnRuleRowSelectTrigger2}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent className={styles.columnRuleRowSelectContent}>
							{OPERATOR_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						type='number'
						value={Number.isFinite(rule.value) ? rule.value : 0}
						onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
						className={styles.columnRuleRowInput}
						aria-label={`Threshold value for ${column}`}
					/>
					<ColorSwatch
						ariaLabel={`Threshold color for ${column}`}
						value={toHexColor(rule.color, DEFAULT_THRESHOLD_HEX)}
						onChange={(color) => onChange({ ...rule, color })}
					/>
				</div>
			)}

			{rule?.type === 'boolean' && (
				<div className={styles.columnRuleRowDiv4}>
					<label className={styles.columnRuleRowLabel}>
						True
						<ColorSwatch
							ariaLabel={`True color for ${column}`}
							value={toHexColor(rule.trueColor, DEFAULT_TRUE_HEX)}
							onChange={(color) => onChange({ ...rule, trueColor: color })}
						/>
					</label>
					<label className={styles.columnRuleRowLabel}>
						False
						<ColorSwatch
							ariaLabel={`False color for ${column}`}
							value={toHexColor(rule.falseColor, DEFAULT_FALSE_HEX)}
							onChange={(color) => onChange({ ...rule, falseColor: color })}
						/>
					</label>
				</div>
			)}

			{rule?.type === 'string' && (
				<div className={styles.columnRuleRowDiv3}>
					<Select
						value={rule.operator}
						onValueChange={(operator) => onChange(withStringOperator(rule, operator as StringOperator))}
					>
						<SelectTrigger className={styles.columnRuleRowSelectTrigger3}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent className={styles.columnRuleRowSelectContent}>
							{STRING_OPERATOR_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						value={stringValueToText(rule.value)}
						onChange={(e) => onChange({ ...rule, value: textToStringValue(rule.operator, e.target.value) })}
						placeholder={rule.operator === 'in' ? 'value1, value2' : 'value'}
						className={styles.columnRuleRowInput2}
						aria-label={`Match value for ${column}`}
					/>
					<ColorSwatch
						ariaLabel={`String color for ${column}`}
						value={toHexColor(rule.color, DEFAULT_THRESHOLD_HEX)}
						onChange={(color) => onChange({ ...rule, color })}
					/>
				</div>
			)}
		</div>
	);
}

function defaultRuleForKind(kind: RuleKind): ConditionalFormatRule | undefined {
	switch (kind) {
		case 'none':
			return undefined;
		case 'color-scale':
			return { type: 'color-scale' };
		case 'threshold':
			return { type: 'threshold', operator: '>=', value: 0, color: DEFAULT_THRESHOLD_COLOR };
		case 'boolean':
			return { type: 'boolean', trueColor: DEFAULT_TRUE_COLOR, falseColor: DEFAULT_FALSE_COLOR };
		case 'string':
			return { type: 'string', operator: 'equals', value: '', color: DEFAULT_THRESHOLD_COLOR };
	}
}

function withStringOperator(rule: StringRule, operator: StringOperator): StringRule {
	if (operator === 'in') {
		const value = Array.isArray(rule.value) ? rule.value : textToStringValue('in', String(rule.value ?? ''));
		return { ...rule, operator, value };
	}
	const value = Array.isArray(rule.value) ? rule.value.join(', ') : rule.value;
	return { ...rule, operator, value };
}

function stringValueToText(value: string | string[]): string {
	return Array.isArray(value) ? value.join(', ') : value;
}

function textToStringValue(operator: StringOperator, text: string): string | string[] {
	if (operator !== 'in') {
		return text;
	}
	return text
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function ColorSwatch({
	ariaLabel,
	value,
	onChange,
}: {
	ariaLabel: string;
	value: string;
	onChange: (color: string) => void;
}) {
	return (
		<input
			type='color'
			aria-label={ariaLabel}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className={styles.colorSwatchInput}
		/>
	);
}

function toHexColor(color: string | undefined, fallback: string): string {
	return (color ? colorToHex(color) : null) ?? fallback;
}
