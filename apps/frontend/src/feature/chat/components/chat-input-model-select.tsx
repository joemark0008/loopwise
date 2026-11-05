import { Link, useNavigate } from '@tanstack/react-router';
import { Settings, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { providerLabel, providerName } from '@loopwise/shared/types';

import styles from './chat-input-model-select.module.css';
import type { LlmProvider, LlmSelectedModel } from '@loopwise/shared/types';

import { LlmProviderIcon } from '@/components/ui/llm-provider-icon';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import LoopwiseIcon from '@/components/icons/loopwise-logo-greyscale.svg';
import { isSameModel, useModelSelection } from '@/hooks/use-model-selection';
import { usePermissions } from '@/hooks/use-permissions';
import { getShortcutLabel } from '@/lib/keyboard-shortcuts';

/** Listed as an option rather than a link, so that the keyboard reaches it like any other. */
const MANAGE_MODELS_VALUE = 'manage-models';
/** Follows the default chat model set by the admin instead of pinning a model. */
const LOOPWISE_DEFAULT_VALUE = 'loopwise-default';
const LOOPWISE_DEFAULT_LABEL = 'Auto';
const EXAMPLE_MODEL_VALUE = 'example-model';
const CLINIC_SETUP_VALUE = 'clinic-setup';
const EXAMPLE_MODEL_NAME = 'GPT 6 Sol';

export function ChatInputModelSelect({ isExample = false }: { isExample?: boolean }) {
	const navigate = useNavigate();
	const { isAdmin } = usePermissions();
	const {
		availableModels,
		defaultModel,
		selectedModel,
		usesDefaultModel,
		setSelectedModel,
		isPending,
		canCycleModels,
		hasClinic,
	} = useModelSelection();
	const { isTooltipOpen, onTooltipOpenChange, onSelectOpenChange } = useSelectTriggerTooltip();

	// Fall back to the loopwise default when the pinned model is no longer available
	useEffect(() => {
		if (usesDefaultModel || !availableModels || availableModels.length === 0) {
			return;
		}
		if (!availableModels.some((model) => isSameModel(model, selectedModel))) {
			setSelectedModel(null);
		}
	}, [usesDefaultModel, availableModels, selectedModel, setSelectedModel]);

	const handleModelValueChange = useCallback(
		(value: string) => {
			if (value === MANAGE_MODELS_VALUE) {
				navigate({ to: '/settings/clinic/models' });
				return;
			}
			if (value === LOOPWISE_DEFAULT_VALUE) {
				setSelectedModel(null);
				return;
			}
			const model = availableModels?.find((m) => `${m.provider}:${m.modelId}` === value);
			if (model) {
				setSelectedModel(model);
			}
		},
		[availableModels, navigate, setSelectedModel],
	);

	const selectedAvailableModel = selectedModel
		? availableModels?.find((model) => isSameModel(model, selectedModel))
		: undefined;
	const defaultAvailableModel = defaultModel
		? availableModels?.find((model) => isSameModel(model, defaultModel))
		: undefined;
	const resolvedModelName = selectedAvailableModel?.name ?? selectedModel?.modelId;
	const selectedModelName = usesDefaultModel ? LOOPWISE_DEFAULT_LABEL : (resolvedModelName ?? 'Select model');
	const selectValue = usesDefaultModel
		? LOOPWISE_DEFAULT_VALUE
		: selectedModel
			? modelValue(selectedModel)
			: undefined;

	if (isExample) {
		return <ExampleModel />;
	}

	if (isPending) {
		return null;
	}

	if (!availableModels?.length) {
		if (!hasClinic) {
			return <ExampleModel />;
		}
		return (
			<Link to='/settings/clinic/models' className={styles.chatInputModelSelectLink}>
				<TriangleAlert className={styles.chatInputModelSelectTriangleAlert} />
				<span>Configure a model</span>
			</Link>
		);
	}

	const singleModel = (
		<>
			{selectedModel && (
				<LlmProviderIcon
					provider={selectedModel.provider}
					baseUrl={selectedAvailableModel?.baseUrl}
					className={styles.singleModelLlmProviderIcon}
				/>
			)}
			<span>{selectedModelName}</span>
			{selectedModel && <NamedProviderHint provider={selectedModel.provider} />}
		</>
	);

	if (!canCycleModels) {
		if (!isAdmin) {
			return <div className={styles.chatInputModelSelectDiv}>{singleModel}</div>;
		}

		return (
			<Link to='/settings/clinic/models' className={styles.chatInputModelSelectLink2}>
				{singleModel}
			</Link>
		);
	}

	return (
		<Select value={selectValue} onValueChange={handleModelValueChange} onOpenChange={onSelectOpenChange}>
			<Tooltip open={isTooltipOpen} onOpenChange={onTooltipOpenChange}>
				<TooltipTrigger asChild>
					<SelectTrigger variant='ghost' className={styles.chatInputModelSelectSelectTrigger} size='sm'>
						<SelectValue>
							<div className={styles.chatInputModelSelectDiv2}>
								{selectedModel && (
									<LlmProviderIcon
										provider={selectedModel.provider}
										baseUrl={selectedAvailableModel?.baseUrl}
										className={styles.singleModelLlmProviderIcon}
									/>
								)}
								<span className={styles.chatInputModelSelectSpan}>{selectedModelName}</span>
								{usesDefaultModel
									? resolvedModelName && (
											<span className={styles.chatInputModelSelectSpan2}>
												{resolvedModelName}
											</span>
										)
									: selectedModel && <NamedProviderHint provider={selectedModel.provider} />}
							</div>
						</SelectValue>
					</SelectTrigger>
				</TooltipTrigger>
				<TooltipContent side='top'>Cycle models with {getShortcutLabel('cycle-model')}</TooltipContent>
			</Tooltip>

			<SelectContent align='center' position='popper' side='top' collisionPadding={12}>
				<SelectItem value={LOOPWISE_DEFAULT_VALUE}>
					{defaultModel && (
						<LlmProviderIcon
							provider={defaultModel.provider}
							baseUrl={defaultAvailableModel?.baseUrl}
							className={styles.chatInputModelSelectLlmProviderIcon}
						/>
					)}
					{LOOPWISE_DEFAULT_LABEL}
					{defaultAvailableModel && (
						<span className={styles.chatInputModelSelectSpan2}>{defaultAvailableModel.name}</span>
					)}
				</SelectItem>
				<SelectSeparator />

				{availableModels?.map((model) => (
					<SelectItem key={`${model.provider}-${model.modelId}`} value={modelValue(model)}>
						<LlmProviderIcon
							provider={model.provider}
							baseUrl={model.baseUrl}
							className={styles.chatInputModelSelectLlmProviderIcon}
						/>
						{model.name}
						<NamedProviderHint provider={model.provider} />
					</SelectItem>
				))}

				{isAdmin && (
					<>
						<SelectSeparator />
						<SelectItem value={MANAGE_MODELS_VALUE} className={styles.chatInputModelSelectSpan2}>
							<Settings className={styles.singleModelLlmProviderIcon} />
							Manage models
						</SelectItem>
					</>
				)}
			</SelectContent>
		</Select>
	);
}

function ExampleModel() {
	return (
		<Select value={EXAMPLE_MODEL_VALUE}>
			<SelectTrigger
				variant='ghost'
				className={styles.chatInputModelSelectSelectTrigger}
				size='sm'
				aria-label='Model'
			>
				<SelectValue>
					<div className={styles.chatInputModelSelectDiv2}>
						<LoopwiseIcon className={styles.exampleModelLoopwiseIcon} />
						<span className={styles.chatInputModelSelectSpan}>{EXAMPLE_MODEL_NAME}</span>
					</div>
				</SelectValue>
			</SelectTrigger>
			<SelectContent align='center' position='popper' side='top' collisionPadding={12}>
				<SelectItem value={EXAMPLE_MODEL_VALUE}>
					<LoopwiseIcon className={styles.exampleModelLoopwiseIcon2} />
					{EXAMPLE_MODEL_NAME}
				</SelectItem>
				<SelectSeparator />
				<SelectItem value={CLINIC_SETUP_VALUE} disabled className={styles.chatInputModelSelectSpan2}>
					<Settings className={styles.singleModelLlmProviderIcon} />
					Set up a clinic to switch models
				</SelectItem>
			</SelectContent>
		</Select>
	);
}

/**
 * Closing the select returns focus to its trigger, which would otherwise open the
 * tooltip and keep it visible. The open request caused by that focus is skipped.
 */
function useSelectTriggerTooltip() {
	const [isTooltipOpen, setIsTooltipOpen] = useState(false);
	const skipNextOpenRef = useRef(false);

	const onSelectOpenChange = useCallback((open: boolean) => {
		setIsTooltipOpen(false);
		skipNextOpenRef.current = !open;
	}, []);

	const onTooltipOpenChange = useCallback((open: boolean) => {
		if (open && skipNextOpenRef.current) {
			skipNextOpenRef.current = false;
			return;
		}
		setIsTooltipOpen(open);
	}, []);

	return { isTooltipOpen, onTooltipOpenChange, onSelectOpenChange };
}

function modelValue(model: LlmSelectedModel): string {
	return `${model.provider}:${model.modelId}`;
}

function NamedProviderHint({ provider }: { provider: LlmProvider }) {
	const name = providerName(provider);
	if (!name) {
		return null;
	}
	return <span className={styles.chatInputModelSelectSpan2}>{providerLabel(provider)}</span>;
}
