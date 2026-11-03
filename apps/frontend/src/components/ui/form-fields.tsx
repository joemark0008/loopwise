import styles from './form-fields.module.css';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type AnyForm = any;

interface TextFieldProps {
	form: AnyForm;
	name: string;
	label: string;
	type?: string;
	placeholder?: string;
	hint?: string;
	required?: boolean;
}

export function TextField({ form, name, label, type = 'text', placeholder, hint, required = false }: TextFieldProps) {
	return (
		<form.Field
			name={name}
			validators={required ? { onChange: validateRequired, onSubmit: validateRequired } : undefined}
		>
			{(field: {
				state: { value: string; meta: { errors: string[] } };
				handleChange: (v: string) => void;
				handleBlur: () => void;
			}) => (
				<div className={styles.textFieldDiv}>
					<label htmlFor={name} className={styles.textFieldLabel}>
						{label}
						{hint && <span className={styles.textFieldSpan}>{hint}</span>}
					</label>
					<Input
						id={name}
						name={name}
						type={type}
						placeholder={placeholder}
						value={field.state.value ?? ''}
						onChange={(e) => field.handleChange(e.target.value)}
						onBlur={field.handleBlur}
						required={required}
					/>
					{field.state.meta.errors.length > 0 && (
						<p className={styles.textFieldP}>{field.state.meta.errors[0]}</p>
					)}
				</div>
			)}
		</form.Field>
	);
}

function validateRequired({ value }: { value: string }): string | undefined {
	return value.trim() ? undefined : 'Required';
}

interface PasswordFieldProps {
	form: AnyForm;
	name: string;
	label: string;
	placeholder?: string;
	hint?: string;
	required?: boolean;
}

export function PasswordField({ form, name, label, placeholder, hint, required = false }: PasswordFieldProps) {
	return (
		<TextField
			form={form}
			name={name}
			label={label}
			type='password'
			placeholder={placeholder}
			hint={hint}
			required={required}
		/>
	);
}

interface TextareaFieldProps {
	form: AnyForm;
	name: string;
	label: string;
	placeholder?: string;
	hint?: string;
	required?: boolean;
	rows?: number;
}

export function TextareaField({
	form,
	name,
	label,
	placeholder,
	hint,
	required = false,
	rows = 4,
}: TextareaFieldProps) {
	return (
		<form.Field
			name={name}
			validators={required ? { onChange: validateRequired, onSubmit: validateRequired } : undefined}
		>
			{(field: {
				state: { value: string; meta: { errors: string[] } };
				handleChange: (v: string) => void;
				handleBlur: () => void;
			}) => (
				<div className={styles.textFieldDiv}>
					<label htmlFor={name} className={styles.textFieldLabel}>
						{label}
						{hint && <span className={styles.textFieldSpan}>{hint}</span>}
					</label>
					<Textarea
						id={name}
						name={name}
						placeholder={placeholder}
						value={field.state.value ?? ''}
						onChange={(e) => field.handleChange(e.target.value)}
						onBlur={field.handleBlur}
						required={required}
						rows={rows}
						className={styles.textareaFieldTextarea}
					/>
					{field.state.meta.errors.length > 0 && (
						<p className={styles.textFieldP}>{field.state.meta.errors[0]}</p>
					)}
				</div>
			)}
		</form.Field>
	);
}

interface FormErrorProps {
	error?: string;
	form?: AnyForm;
}

type FormLevelError = string | { form?: string; fields?: Record<string, string> } | undefined;

export function FormError({ error, form }: FormErrorProps) {
	// If form is provided, subscribe to form-level errors
	if (form) {
		return (
			<form.Subscribe selector={(state: { errorMap: { onSubmit?: FormLevelError } }) => state.errorMap.onSubmit}>
				{(formError: FormLevelError) => {
					// Extract error message from either string or object format
					const formErrorMessage = typeof formError === 'string' ? formError : formError?.form;
					const displayError = error || formErrorMessage;
					if (!displayError) {
						return null;
					}
					return <p className={styles.formErrorP}>{displayError}</p>;
				}}
			</form.Subscribe>
		);
	}

	// Fallback for standalone error prop
	if (!error) {
		return null;
	}
	return <p className={styles.formErrorP}>{error}</p>;
}

export function getSubmitErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

interface FormActionsProps {
	form: AnyForm;
	submitText: string;
	onCancel?: () => void;
	showCancel?: boolean;
	isPending?: boolean;
	submitIcon?: React.ReactNode;
}

export function FormActions({
	form,
	submitText,
	onCancel,
	showCancel = true,
	isPending = false,
	submitIcon,
}: FormActionsProps) {
	return (
		<form.Subscribe selector={(state: { canSubmit: boolean }) => state.canSubmit}>
			{(canSubmit: boolean) => (
				<div className={styles.formActionsDiv}>
					{showCancel && onCancel && (
						<button type='button' onClick={onCancel} className={styles.formActionsButton}>
							Cancel
						</button>
					)}
					<button type='submit' disabled={!canSubmit || isPending} className={styles.formActionsButton2}>
						{submitIcon}
						{submitText}
					</button>
				</div>
			)}
		</form.Subscribe>
	);
}
