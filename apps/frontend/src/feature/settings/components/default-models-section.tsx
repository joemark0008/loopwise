import {
	BACKGROUND_MODEL_CATEGORIES,
	BACKGROUND_MODEL_CATEGORY_DESCRIPTIONS,
	BACKGROUND_MODEL_CATEGORY_LABELS,
	setBackgroundModelForCategory,
	setBackgroundModelMode,
	setDefaultChatModel,
	setSingleBackgroundModel,
} from '@loopwise/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { findModel, ModelSelectField } from './model-select-field';
import styles from './default-models-section.module.css';
import type { BackgroundModelCategory, BackgroundModelMode, DefaultModelSettings } from '@loopwise/shared';
import type { ReactNode } from 'react';
import type { AvailableModel, ResolvedModel } from './model-select-field';

import { LlmProviderIcon } from '@/components/ui/llm-provider-icon';
import { SettingsCard } from '@/components/ui/settings-card';
import { cn } from '@/lib/utils';
import { clinicApi } from '@/lib/clinic-api';

interface DefaultModelsSectionProps {
	isAdmin: boolean;
}

export function DefaultModelsSection({ isAdmin }: DefaultModelsSectionProps) {
	const queryClient = useQueryClient();
	const { data } = useQuery(clinicApi.clinic.getDefaultModels.queryOptions());
	const invalidate = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: clinicApi.clinic.getDefaultModels.queryOptions().queryKey }),
			queryClient.invalidateQueries({ queryKey: clinicApi.clinic.getDefaultChatModel.queryOptions().queryKey }),
		]);
	const updateMutation = useMutation(clinicApi.clinic.updateDefaultModels.mutationOptions({ onSuccess: invalidate }));

	const availableModels = (data?.availableModels ?? []) as AvailableModel[];
	const settings = data?.settings ?? null;
	const builtInDefaults = data?.builtInDefaults;
	const mode: BackgroundModelMode = settings?.mode ?? 'single';
	const disabled = !isAdmin || updateMutation.isPending;
	const hasModels = availableModels.length > 0;

	const save = (next: DefaultModelSettings) => updateMutation.mutate(next);

	const handleModeChange = (nextMode: BackgroundModelMode) => {
		if (nextMode !== mode) {
			save(setBackgroundModelMode(settings, nextMode));
		}
	};

	return (
		<SettingsCard
			title='Default models'
			description='Pick which models Loopwise uses when nothing selects one explicitly. Every "Loopwise default" shows the model it currently resolves to, so you can see what changes when you pick another one.'
		>
			{!hasModels ? (
				<p className={styles.defaultModelsSectionP}>
					No models are available yet. Configure an LLM provider in the{' '}
					<span className={styles.defaultModelsSectionSpan}>LLM Configuration</span> section above.
				</p>
			) : (
				<div className={styles.defaultModelsSectionDiv}>
					<SettingsGroup title='Chat' description='The model that answers users in the chat.'>
						<ModelSelectField
							label='New chats'
							description='The model the chat picker starts on. Users can still switch models while chatting.'
							value={settings?.chat}
							defaultOption={{ label: 'Loopwise default', model: builtInDefaults?.chat }}
							availableModels={availableModels}
							disabled={disabled}
							onChange={(selection) => save(setDefaultChatModel(settings, selection))}
						/>
					</SettingsGroup>

					<SettingsGroup
						title='Background tasks'
						description='Helpers that run without a user picking a model.'
					>
						<ModeToggle mode={mode} onChange={handleModeChange} disabled={disabled} />

						{mode === 'single' ? (
							<>
								<ModelSelectField
									label='Default for background tasks'
									description='Used for every background task listed below.'
									value={settings?.single}
									defaultOption={{ label: 'Loopwise default', hint: 'a model per task' }}
									availableModels={availableModels}
									disabled={disabled}
									onChange={(selection) => save(setSingleBackgroundModel(settings, selection))}
								/>
								{!settings?.single && builtInDefaults && (
									<BuiltInTaskModels
										categories={builtInDefaults.categories}
										availableModels={availableModels}
									/>
								)}
							</>
						) : (
							<div className={styles.defaultModelsSectionDiv2}>
								{BACKGROUND_MODEL_CATEGORIES.map((category) => (
									<ModelSelectField
										key={category}
										label={BACKGROUND_MODEL_CATEGORY_LABELS[category]}
										description={BACKGROUND_MODEL_CATEGORY_DESCRIPTIONS[category]}
										value={settings?.categories?.[category]}
										defaultOption={{
											label: 'Loopwise default',
											model: builtInDefaults?.categories[category],
										}}
										availableModels={availableModels}
										disabled={disabled}
										onChange={(selection) =>
											save(setBackgroundModelForCategory(settings, category, selection))
										}
									/>
								))}
							</div>
						)}
					</SettingsGroup>
				</div>
			)}
		</SettingsCard>
	);
}

function SettingsGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
	return (
		<section className={styles.defaultModelsSectionDiv2}>
			<div className={styles.settingsGroupDiv}>
				<h4 className={styles.settingsGroupH4}>{title}</h4>
				<p className={styles.settingsGroupP}>{description}</p>
			</div>
			{children}
		</section>
	);
}

function ModeToggle({
	mode,
	onChange,
	disabled,
}: {
	mode: BackgroundModelMode;
	onChange: (mode: BackgroundModelMode) => void;
	disabled: boolean;
}) {
	const options: { value: BackgroundModelMode; label: string }[] = [
		{ value: 'single', label: 'One default for everything' },
		{ value: 'perCategory', label: 'A model per task' },
	];

	return (
		<div className={styles.modeToggleDiv}>
			{options.map((option) => (
				<button
					key={option.value}
					type='button'
					disabled={disabled}
					onClick={() => onChange(option.value)}
					className={cn(
						styles.modeToggleButton,
						mode === option.value ? styles.modeToggleButton2 : styles.modeToggleButton3,
						disabled && styles.modeToggleButton4,
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

function BuiltInTaskModels({
	categories,
	availableModels,
}: {
	categories: Partial<Record<BackgroundModelCategory, ResolvedModel>>;
	availableModels: AvailableModel[];
}) {
	return (
		<dl className={styles.builtInTaskModelsDl}>
			{BACKGROUND_MODEL_CATEGORIES.map((category) => {
				const model = categories[category];
				return (
					<div key={category} className={styles.builtInTaskModelsDiv}>
						<dt className={styles.builtInTaskModelsDt}>{BACKGROUND_MODEL_CATEGORY_LABELS[category]}</dt>
						<dd className={styles.builtInTaskModelsDd}>
							{model ? (
								<>
									<LlmProviderIcon
										provider={model.provider}
										baseUrl={findModel(availableModels, model)?.baseUrl ?? null}
										className={styles.builtInTaskModelsLlmProviderIcon}
									/>
									{model.name}
								</>
							) : (
								<span className={styles.builtInTaskModelsDt}>No model available</span>
							)}
						</dd>
					</div>
				);
			})}
		</dl>
	);
}
