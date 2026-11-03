import { useEffect, useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Check, ChevronDown, MoreHorizontal, Plus, TriangleAlert, X } from 'lucide-react';
import {
	getDefaultModelId,
	getModelParameterSpec,
	getProviderAuth,
	PROVIDER_META,
} from '@loopwise/api/agent/providers/provider-meta';
import { NAMED_PROVIDER_KIND, providerKind, providerLabels, toProviderName } from '@loopwise/shared/types';
import { CustomModelDialog } from './custom-model-dialog';
import { ModelParametersDialog } from './model-parameters-dialog';
import { applySavedModelSettings } from './model-settings-overrides';
import styles from './llm-provider-form.module.css';
import type { CustomModelMetadata, ModelSettingsMap } from '@loopwise/api/agent/types/llm';
import type { LlmProvider } from '@loopwise/shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordField, TextField, TextareaField, FormError } from '@/components/ui/form-fields';

/** Where credentials already come from when the UI is only layering settings on top. */
export type InheritedKeySource = 'env' | 'config';

const INHERITED_KEY_LABELS: Record<InheritedKeySource, string> = {
	env: 'env',
	config: 'loopwise_config.yaml',
};

export interface LlmProviderFormProps {
	provider: LlmProvider;
	isEditing: boolean;
	inheritedKeySource: InheritedKeySource | null;
	initialValues?: {
		enabledModels: string[];
		customModels: CustomModelMetadata[];
		modelSettings: ModelSettingsMap;
		baseUrl: string;
	};
	/** Model whose settings dialog opens as soon as the form is shown. */
	initialEditedModelId?: string;
	currentModels: readonly { id: string; name: string; default?: boolean }[];
	takenNames?: readonly string[];
	onSubmit: (values: {
		apiKey?: string;
		credentials?: Record<string, string>;
		name?: string;
		enabledModels: string[];
		customModels: CustomModelMetadata[];
		modelSettings: ModelSettingsMap;
		baseUrl?: string;
	}) => Promise<void>;
	onCancel: () => void;
	isPending: boolean;
	error: { message: string } | null;
	title: string;
	showPlusIcon?: boolean;
	noWrapper?: boolean;
}

export function LlmProviderForm({
	provider,
	isEditing,
	inheritedKeySource,
	initialValues,
	initialEditedModelId,
	currentModels,
	takenNames = [],
	onSubmit,
	onCancel,
	isPending,
	error,
	title,
	showPlusIcon = false,
	noWrapper = false,
}: LlmProviderFormProps) {
	const [showAdvanced, setShowAdvanced] = useState(!!initialValues?.baseUrl);
	const [customModelInput, setCustomModelInput] = useState('');
	const isCustomModel = (modelId: string) => !currentModels.some((m) => m.id === modelId);
	const supportsModelParameters = (modelId: string) => getModelParameterSpec(provider, modelId).length > 0;
	function resolveEditingCustomModelId(modelId: string | undefined): string | null {
		return modelId && isCustomModel(modelId) ? modelId : null;
	}
	function resolveEditingModelParamsId(modelId: string | undefined): string | null {
		return modelId && !isCustomModel(modelId) && supportsModelParameters(modelId) ? modelId : null;
	}
	const [editingCustomModelId, setEditingCustomModelId] = useState<string | null>(() =>
		resolveEditingCustomModelId(initialEditedModelId),
	);
	const [editingModelParamsId, setEditingModelParamsId] = useState<string | null>(() =>
		resolveEditingModelParamsId(initialEditedModelId),
	);
	const [focusedModelId, setFocusedModelId] = useState(initialEditedModelId);
	if (initialEditedModelId !== focusedModelId) {
		setFocusedModelId(initialEditedModelId);
		setEditingCustomModelId(resolveEditingCustomModelId(initialEditedModelId));
		setEditingModelParamsId(resolveEditingModelParamsId(initialEditedModelId));
	}
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (initialEditedModelId) {
			containerRef.current?.scrollIntoView({ block: 'center' });
		}
	}, [initialEditedModelId]);
	const providerAuth = getProviderAuth(provider);
	const showApiKey = providerAuth.apiKey !== 'none';
	const extraFields = providerAuth.extraFields ?? [];
	const kind = providerKind(provider);
	const providerLabel = providerLabels[kind];
	const providerMeta = PROVIDER_META[kind];
	const defaultModelId = getDefaultModelId(provider);
	// A project can hold several endpoints of this kind, told apart by the name given here.
	const needsName = !isEditing && kind === NAMED_PROVIDER_KIND;

	const defaultCredentials = Object.fromEntries(extraFields.map((f) => [f.name, '']));
	const inheritedKeyLabel = inheritedKeySource ? INHERITED_KEY_LABELS[inheritedKeySource] : null;

	const form = useForm({
		defaultValues: {
			apiKey: '',
			credentials: defaultCredentials,
			name: '',
			enabledModels: initialValues?.enabledModels ?? [],
			customModels: initialValues?.customModels ?? ([] as CustomModelMetadata[]),
			modelSettings: initialValues?.modelSettings ?? ({} as ModelSettingsMap),
			baseUrl: initialValues?.baseUrl ?? '',
		},
		onSubmit: async ({ value }) => {
			const filledCredentials = Object.fromEntries(Object.entries(value.credentials).filter(([, v]) => v));

			await onSubmit({
				apiKey: value.apiKey || undefined,
				credentials: Object.keys(filledCredentials).length > 0 ? filledCredentials : undefined,
				name: needsName ? value.name : undefined,
				enabledModels: value.enabledModels,
				customModels: value.customModels,
				modelSettings: value.modelSettings,
				baseUrl: value.baseUrl || undefined,
			});
		},
	});

	const getApiKeyHint = () => {
		if (inheritedKeyLabel) {
			return `(optional - leave empty to use ${inheritedKeyLabel})`;
		}
		if (providerAuth.apiKey === 'optional') {
			return providerAuth.hint ? `(${providerAuth.hint})` : '(optional)';
		}
		if (isEditing) {
			return '(leave empty to keep current)';
		}
		return '';
	};

	const getApiKeyPlaceholder = () => {
		if (inheritedKeyLabel) {
			const credentialLabel = providerAuth.apiKey === 'optional' ? 'bearer token' : 'API key';
			return `Enter ${credentialLabel} to override ${inheritedKeyLabel}`;
		}
		if (providerAuth.apiKey === 'optional') {
			return 'Enter bearer token or leave empty for env credentials';
		}
		if (isEditing) {
			return 'Enter new API key to update';
		}
		return `Enter your ${providerLabel} API key`;
	};

	const saveProviderIfEditing = () => {
		if (isEditing) {
			void form.handleSubmit();
		}
	};

	const addCustomModel = () => {
		const trimmed = customModelInput.trim();
		if (!trimmed) {
			return;
		}
		const enabledModels = form.getFieldValue('enabledModels');
		if (!enabledModels.includes(trimmed)) {
			form.setFieldValue('enabledModels', [...enabledModels, trimmed]);
		}
		setCustomModelInput('');
	};

	const nameError = (value: string): string | undefined => {
		const normalized = toProviderName(value);
		if (!value) {
			return undefined;
		}
		if (!normalized) {
			return 'Name this endpoint with letters, digits and dashes.';
		}
		return takenNames.includes(normalized) ? `An endpoint named ${normalized} already exists.` : undefined;
	};

	const nameField = (
		<form.Field name='name' validators={{ onChange: ({ value }: { value: string }) => nameError(value) }}>
			{(field) => {
				const normalized = toProviderName(field.state.value);
				const invalid = nameError(field.state.value);
				return (
					<div className={styles.nameFieldDiv}>
						<label htmlFor='provider-name' className={styles.nameFieldLabel}>
							Name <span className={styles.nameFieldSpan}>(required)</span>
						</label>
						<Input
							id='provider-name'
							type='text'
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							required
							placeholder='e.g., my-vllm'
						/>
						<p className={`${styles.nameFieldP} ${invalid ? styles.state100 : styles.state101}`}>
							{invalid ??
								(normalized
									? `Models of this endpoint are listed under ${normalized}.`
									: 'How this endpoint is named across the app, so you can add several of them.')}
						</p>
					</div>
				);
			}}
		</form.Field>
	);

	const baseUrlField = (
		<form.Field name='baseUrl'>
			{(field) => (
				<div className={providerMeta.requiresBaseUrl ? styles.nameFieldDiv : styles.baseUrlFieldDiv}>
					<label htmlFor='base-url' className={styles.nameFieldLabel}>
						Base URL{' '}
						<span className={styles.nameFieldSpan}>
							{providerMeta.requiresBaseUrl ? '(required)' : '(optional)'}
						</span>
					</label>
					<Input
						id='base-url'
						type='url'
						value={field.state.value}
						onChange={(e) => field.handleChange(e.target.value)}
						onBlur={field.handleBlur}
						required={providerMeta.requiresBaseUrl}
						placeholder={`e.g., ${providerMeta.defaultBaseUrl ?? 'http://localhost:8000/v1'}`}
					/>
					<p className={styles.baseUrlFieldP}>
						{providerMeta.requiresBaseUrl
							? 'The OpenAI-compatible endpoint to call, up to and including its version segment.'
							: 'Use a custom endpoint instead of the default provider URL.'}
					</p>
				</div>
			)}
		</form.Field>
	);

	const content = (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				addCustomModel();
				form.handleSubmit();
			}}
			className={styles.contentForm}
		>
			{/* Header */}
			<div className={styles.contentDiv}>
				<span className={styles.nameFieldLabel}>
					{title}
					{inheritedKeyLabel && (
						<span className={styles.contentSpan}>(using {inheritedKeyLabel} API key)</span>
					)}
				</span>
				<Button variant='ghost' size='icon-sm' onClick={onCancel} type='button'>
					<X className={styles.contentX} />
				</Button>
			</div>

			{inheritedKeySource === 'config' && (
				<div className={styles.contentDiv2}>
					<TriangleAlert className={styles.contentTriangleAlert} />
					<p className={styles.contentP}>
						This provider is defined in <span className={styles.contentSpan2}>loopwise_config.yaml</span>.
						Settings saved here are stored in the project and take precedence over the file, so later edits
						to <span className={styles.contentSpan2}>loopwise_config.yaml</span> are ignored until you
						delete this provider here.
					</p>
				</div>
			)}

			{needsName && nameField}

			{showApiKey && (
				<PasswordField
					form={form}
					name='apiKey'
					label='API Key'
					hint={getApiKeyHint()}
					placeholder={getApiKeyPlaceholder()}
					required={providerAuth.apiKey === 'required' && !isEditing && !inheritedKeySource}
				/>
			)}

			{providerMeta.requiresBaseUrl && baseUrlField}

			{extraFields.map((field) => {
				const FieldComponent = field.multiline ? TextareaField : field.secret ? PasswordField : TextField;
				const hint = isEditing ? '(leave empty to keep current)' : `(or set ${field.envVar} in env)`;
				return (
					<FieldComponent
						key={field.name}
						form={form}
						name={`credentials.${field.name}`}
						label={field.label}
						hint={hint}
						placeholder={field.placeholder ?? `Enter ${field.label}`}
					/>
				);
			})}

			{/* Model selection */}
			<form.Field name='enabledModels'>
				{(field) => {
					const enabledModels = field.state.value;

					const toggleModel = (modelId: string) => {
						if (enabledModels.includes(modelId)) {
							field.handleChange(enabledModels.filter((m) => m !== modelId));
							return;
						}

						// First selection while default is implicitly selected - keep the default too
						if (enabledModels.length === 0) {
							const defaultModel = currentModels.find((m) => m.default);
							if (defaultModel && defaultModel.id !== modelId) {
								field.handleChange([defaultModel.id, modelId]);
								return;
							}
						}

						field.handleChange([...enabledModels, modelId]);
					};

					return (
						<div className={styles.nameFieldDiv}>
							<label className={styles.nameFieldLabel}>
								Enabled Models
								<span className={styles.contentSpan}>
									{defaultModelId
										? `(leave empty for default ${defaultModelId})`
										: '(add the model IDs your endpoint serves)'}
								</span>
							</label>
							<div className={styles.contentDiv3}>
								{currentModels.map((model) => {
									const isExplicitlyEnabled = enabledModels.includes(model.id);
									const isDefaultSelected = enabledModels.length === 0 && model.default;
									const isEnabled = isExplicitlyEnabled || isDefaultSelected;

									if (isEnabled && supportsModelParameters(model.id)) {
										return (
											<div key={model.id} className={styles.contentDiv4}>
												<button
													type='button'
													onClick={() => toggleModel(model.id)}
													className={styles.contentButton}
												>
													<Check className={styles.contentCheck} />
													{model.name}
												</button>
												<button
													type='button'
													onClick={() => setEditingModelParamsId(model.id)}
													className={styles.contentButton2}
													aria-label={`Edit ${model.name} parameters`}
												>
													<MoreHorizontal className={styles.contentMoreHorizontal} />
												</button>
											</div>
										);
									}

									return (
										<button
											key={model.id}
											type='button'
											onClick={() => toggleModel(model.id)}
											className={`${styles.contentButton3} ${isEnabled ? styles.state102 : styles.state103} `}
										>
											{isEnabled && <Check className={styles.contentCheck} />}
											{model.name}
										</button>
									);
								})}
								<form.Field name='customModels'>
									{(customModelsField) => {
										const customModels = customModelsField.state.value;
										return (
											<>
												{enabledModels.filter(isCustomModel).map((modelId) => {
													const metadata = customModels.find((m) => m.id === modelId);
													const label = metadata?.displayName?.trim() || modelId;
													return (
														<div key={modelId} className={styles.contentDiv5}>
															<button
																type='button'
																onClick={() => toggleModel(modelId)}
																className={styles.contentButton4}
																aria-label={`Remove ${modelId}`}
															>
																<X className={styles.contentX2} />
															</button>
															<span title={modelId}>{label}</span>
															<button
																type='button'
																onClick={() => setEditingCustomModelId(modelId)}
																className={styles.contentButton2}
																aria-label={`Edit ${modelId}`}
															>
																<MoreHorizontal
																	className={styles.contentMoreHorizontal}
																/>
															</button>
														</div>
													);
												})}
											</>
										);
									}}
								</form.Field>
							</div>
							<div className={styles.contentDiv6}>
								<Input
									type='text'
									value={customModelInput}
									onChange={(e) => setCustomModelInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											addCustomModel();
										}
									}}
									placeholder='Add custom model ID...'
									className={styles.contentInput}
								/>
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={addCustomModel}
									disabled={!customModelInput.trim()}
								>
									<Plus className={styles.contentX} />
								</Button>
							</div>
						</div>
					);
				}}
			</form.Field>

			{/* Advanced settings toggle */}
			{!providerMeta.requiresBaseUrl && (
				<>
					<button
						type='button'
						onClick={() => setShowAdvanced(!showAdvanced)}
						className={styles.contentButton5}
					>
						<ChevronDown
							className={`${styles.contentChevronDown} ${showAdvanced ? styles.state104 : ''}`}
						/>
						Advanced settings
					</button>
					{showAdvanced && baseUrlField}
				</>
			)}

			{/* Error display */}
			{error && <FormError error={error.message} />}

			{/* Action buttons */}
			<div className={styles.contentDiv7}>
				<Button variant='ghost' size='sm' onClick={onCancel} type='button'>
					Cancel
				</Button>
				<form.Subscribe selector={(state: { canSubmit: boolean }) => state.canSubmit}>
					{(canSubmit: boolean) => (
						<Button size='sm' type='submit' disabled={!canSubmit || isPending}>
							{showPlusIcon && <Plus className={styles.contentPlus} />}
							{isEditing ? 'Save Changes' : 'Save'}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);

	const customModelDialog = (
		<form.Field name='customModels'>
			{(field) => (
				<CustomModelDialog
					open={editingCustomModelId !== null}
					onOpenChange={(open) => {
						if (!open) {
							setEditingCustomModelId(null);
						}
					}}
					provider={provider}
					modelId={editingCustomModelId ?? ''}
					value={field.state.value.find((m) => m.id === editingCustomModelId)}
					onSave={(metadata) => {
						const next = field.state.value.filter((m) => m.id !== metadata.id);
						field.handleChange([...next, metadata]);
					}}
					parametersValue={
						editingCustomModelId ? form.getFieldValue('modelSettings')[editingCustomModelId] : undefined
					}
					onSaveParameters={(settings) => {
						if (!editingCustomModelId) {
							return;
						}
						const next = applySavedModelSettings({
							provider,
							enabledModels: form.getFieldValue('enabledModels'),
							modelSettings: form.getFieldValue('modelSettings'),
							modelId: editingCustomModelId,
							settings,
						});
						form.setFieldValue('modelSettings', next.modelSettings);
						saveProviderIfEditing();
					}}
				/>
			)}
		</form.Field>
	);

	const modelParametersDialog = (
		<form.Field name='modelSettings'>
			{(field) => {
				const model = currentModels.find((m) => m.id === editingModelParamsId);
				return (
					<ModelParametersDialog
						open={editingModelParamsId !== null}
						onOpenChange={(open) => {
							if (!open) {
								setEditingModelParamsId(null);
							}
						}}
						provider={provider}
						model={{
							id: editingModelParamsId ?? '',
							name: model?.name ?? editingModelParamsId ?? '',
						}}
						value={editingModelParamsId ? field.state.value[editingModelParamsId] : undefined}
						onSave={(settings) => {
							if (!editingModelParamsId) {
								return;
							}
							const enabledModels = form.getFieldValue('enabledModels');
							const next = applySavedModelSettings({
								provider,
								enabledModels,
								modelSettings: field.state.value,
								modelId: editingModelParamsId,
								settings,
							});
							if (next.enabledModels !== enabledModels) {
								form.setFieldValue('enabledModels', next.enabledModels);
							}
							field.handleChange(next.modelSettings);
							saveProviderIfEditing();
						}}
					/>
				);
			}}
		</form.Field>
	);

	if (noWrapper) {
		return (
			<>
				{content}
				{customModelDialog}
				{modelParametersDialog}
			</>
		);
	}

	return (
		<>
			<div ref={containerRef} className={styles.llmProviderFormDiv}>
				{content}
			</div>
			{customModelDialog}
			{modelParametersDialog}
		</>
	);
}
