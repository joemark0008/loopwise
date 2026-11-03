import { AlertTriangle } from 'lucide-react';
import { useId } from 'react';
import styles from './model-select-field.module.css';
import type { ReactNode } from 'react';
import type { LlmProvider, LlmSelectedModel } from '@loopwise/shared/types';

import { LlmProviderIcon } from '@/components/ui/llm-provider-icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type AvailableModel = { provider: LlmProvider; modelId: string; name: string; baseUrl: string | null };
export type ResolvedModel = { provider: LlmProvider; modelId: string; name: string };

/** The entry offered on top of the model list, standing for "let loopwise decide". */
export interface DefaultModelOption {
	label: string;
	model?: ResolvedModel | null;
	hint?: string;
}

const DEFAULT_VALUE = '__loopwise_default__';

const FALLBACK_UNAVAILABLE_WARNING =
	'The selected model is no longer available. Loopwise automatically falls back to another available model until you pick a new one.';

export function ModelSelectField({
	icon,
	label,
	description,
	value,
	unavailableWarning = FALLBACK_UNAVAILABLE_WARNING,
	defaultOption,
	availableModels,
	disabled,
	onChange,
}: {
	icon?: ReactNode;
	label: ReactNode;
	description: ReactNode;
	value: LlmSelectedModel | null | undefined;
	unavailableWarning?: string;
	defaultOption: DefaultModelOption;
	availableModels: AvailableModel[];
	disabled: boolean;
	onChange: (selection: LlmSelectedModel | null) => void;
}) {
	const labelId = useId();
	const descriptionId = useId();
	const selected = value ? findModel(availableModels, value) : null;
	const isUnavailable = !!value && !selected;

	const handleChange = (nextValue: string) => {
		if (nextValue === DEFAULT_VALUE) {
			onChange(null);
			return;
		}
		const model = availableModels.find((m) => modelValue(m) === nextValue);
		if (model) {
			onChange({ provider: model.provider, modelId: model.modelId });
		}
	};

	return (
		<div className={styles.modelSelectFieldDiv}>
			<div className={styles.modelSelectFieldDiv2}>
				{icon}
				<label id={labelId} className={styles.modelSelectFieldLabel}>
					{label}
				</label>
				{isUnavailable && (
					<SimpleTooltip content={unavailableWarning}>
						<AlertTriangle className={styles.modelSelectFieldAlertTriangle} />
					</SimpleTooltip>
				)}
			</div>
			<p id={descriptionId} className={styles.modelSelectFieldP}>
				{description}
			</p>
			<Select value={value ? modelValue(value) : DEFAULT_VALUE} onValueChange={handleChange} disabled={disabled}>
				<SelectTrigger
					className={styles.modelSelectFieldSelectTrigger}
					aria-labelledby={labelId}
					aria-describedby={descriptionId}
				>
					<SelectValue>
						{value ? (
							<div className={styles.modelSelectFieldDiv2}>
								<LlmProviderIcon
									provider={value.provider}
									baseUrl={selected?.baseUrl ?? null}
									className={styles.modelSelectFieldLlmProviderIcon}
								/>
								<span className={cn(isUnavailable && styles.modelSelectFieldSpan)}>
									{selected?.name ?? value.modelId}
								</span>
							</div>
						) : (
							<DefaultOptionContent option={defaultOption} availableModels={availableModels} />
						)}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={DEFAULT_VALUE}>
						<DefaultOptionContent option={defaultOption} availableModels={availableModels} />
					</SelectItem>
					{availableModels.map((model) => (
						<SelectItem key={modelValue(model)} value={modelValue(model)}>
							<LlmProviderIcon
								provider={model.provider}
								baseUrl={model.baseUrl}
								className={styles.modelSelectFieldLlmProviderIcon}
							/>
							{model.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function DefaultOptionContent({
	option,
	availableModels,
}: {
	option: DefaultModelOption;
	availableModels: AvailableModel[];
}) {
	const { label, model, hint } = option;
	const detail = model ? model.name : hint;

	return (
		<div className={styles.modelSelectFieldDiv2}>
			{model && (
				<LlmProviderIcon
					provider={model.provider}
					baseUrl={findModel(availableModels, model)?.baseUrl ?? null}
					className={styles.modelSelectFieldLlmProviderIcon}
				/>
			)}
			<span className={styles.defaultOptionContentSpan}>
				{label}
				{detail && <span> · {detail}</span>}
			</span>
		</div>
	);
}

export function findModel(availableModels: AvailableModel[], model: LlmSelectedModel): AvailableModel | undefined {
	return availableModels.find((m) => m.provider === model.provider && m.modelId === model.modelId);
}

function modelValue(model: { provider: string; modelId: string }): string {
	return JSON.stringify([model.provider, model.modelId]);
}
