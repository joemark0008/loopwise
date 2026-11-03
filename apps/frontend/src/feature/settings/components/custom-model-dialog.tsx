import { useEffect, useRef, useState } from 'react';
import { ModelParametersFields } from './model-parameters-fields';
import { useModelParameters } from './use-model-parameters';
import styles from './custom-model-dialog.module.css';
import type { CustomModelMetadata, ModelInferenceSettings } from '@loopwise/api/agent/types/llm';
import type { LlmProvider } from '@loopwise/shared/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface CustomModelDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	provider: LlmProvider;
	modelId: string;
	value: CustomModelMetadata | undefined;
	onSave: (metadata: CustomModelMetadata) => void;
	parametersValue?: ModelInferenceSettings;
	onSaveParameters?: (settings: ModelInferenceSettings) => void;
}

type CostKey = 'inputNoCache' | 'inputCacheRead' | 'inputCacheWrite' | 'output';

const COST_FIELDS: { key: CostKey; label: string; hint: string }[] = [
	{ key: 'inputNoCache', label: 'Input', hint: 'Uncached input tokens' },
	{ key: 'output', label: 'Output', hint: 'Generated tokens' },
	{ key: 'inputCacheRead', label: 'Cache read', hint: 'Cached input tokens read' },
	{ key: 'inputCacheWrite', label: 'Cache write', hint: 'Cached input tokens written' },
];

export function CustomModelDialog({
	open,
	onOpenChange,
	provider,
	modelId,
	value,
	onSave,
	parametersValue,
	onSaveParameters,
}: CustomModelDialogProps) {
	const parameters = useModelParameters({ provider, modelId, open, value: parametersValue });
	const supportsModelParameters = parameters.controls.length > 0;
	const [displayName, setDisplayName] = useState('');
	const [costs, setCosts] = useState<Record<CostKey, string>>({
		inputNoCache: '',
		inputCacheRead: '',
		inputCacheWrite: '',
		output: '',
	});
	const wasOpenRef = useRef(false);

	useEffect(() => {
		const justOpened = open && !wasOpenRef.current;
		wasOpenRef.current = open;
		if (!justOpened) {
			return;
		}
		setDisplayName(value?.displayName ?? '');
		setCosts({
			inputNoCache: formatCost(value?.costPerM?.inputNoCache),
			inputCacheRead: formatCost(value?.costPerM?.inputCacheRead),
			inputCacheWrite: formatCost(value?.costPerM?.inputCacheWrite),
			output: formatCost(value?.costPerM?.output),
		});
	}, [open, value]);

	const handleSave = () => {
		if (parameters.hasErrors) {
			return;
		}
		const costPerM = buildCostPerM(costs);
		const trimmedName = displayName.trim();
		onSave({
			id: modelId,
			displayName: trimmedName || undefined,
			costPerM,
		});
		if (supportsModelParameters) {
			onSaveParameters?.(parameters.buildSettings());
		}
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={styles.customModelDialogDialogContent}>
				<DialogHeader>
					<DialogTitle>Custom model settings</DialogTitle>
					<DialogDescription className={styles.customModelDialogDialogDescription}>
						{modelId}
					</DialogDescription>
				</DialogHeader>

				<div className={styles.customModelDialogDiv}>
					<div className={styles.customModelDialogDiv2}>
						<label htmlFor='custom-model-display-name' className={styles.customModelDialogLabel}>
							Display name
							<span className={styles.customModelDialogSpan}>(optional)</span>
						</label>
						<Input
							id='custom-model-display-name'
							placeholder={modelId}
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
						/>
					</div>

					<div className={styles.customModelDialogDiv2}>
						<div className={styles.customModelDialogDiv3}>
							<span className={styles.customModelDialogLabel}>Token cost</span>
							<span className={styles.customModelDialogSpan2}>USD / 1M tokens</span>
						</div>
						<div className={styles.customModelDialogDiv4}>
							{COST_FIELDS.map((field) => (
								<div key={field.key} className={styles.customModelDialogDiv5}>
									<label
										htmlFor={`custom-model-cost-${field.key}`}
										className={styles.customModelDialogLabel2}
									>
										{field.label}
									</label>
									<div className={styles.customModelDialogDiv6}>
										<span className={styles.customModelDialogSpan3}>$</span>
										<Input
											id={`custom-model-cost-${field.key}`}
											type='number'
											inputMode='decimal'
											step='0.01'
											min='0'
											placeholder='0'
											className={styles.customModelDialogInput}
											value={costs[field.key]}
											onChange={(e) =>
												setCosts((prev) => ({ ...prev, [field.key]: e.target.value }))
											}
										/>
									</div>
								</div>
							))}
						</div>
						<p className={styles.customModelDialogSpan2}>
							Leave a field empty to skip cost tracking for that token type.
						</p>
					</div>

					{supportsModelParameters && (
						<div className={styles.customModelDialogDiv7}>
							<span className={styles.customModelDialogLabel}>Model parameters</span>
							<ModelParametersFields
								controls={parameters.controls}
								values={parameters.values}
								errors={parameters.errors}
								onValueChange={parameters.setValue}
							/>
						</div>
					)}
				</div>

				<div className={styles.customModelDialogDiv8}>
					<Button variant='ghost' size='sm' onClick={() => onOpenChange(false)} type='button'>
						Cancel
					</Button>
					<Button size='sm' onClick={handleSave} type='button' disabled={parameters.hasErrors}>
						Save
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function formatCost(value: number | undefined): string {
	if (value === undefined || Number.isNaN(value)) {
		return '';
	}
	return String(value);
}

function parseCost(value: string): number | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return undefined;
	}
	return parsed;
}

function buildCostPerM(costs: Record<CostKey, string>): CustomModelMetadata['costPerM'] {
	const parsed: NonNullable<CustomModelMetadata['costPerM']> = {
		inputNoCache: parseCost(costs.inputNoCache),
		inputCacheRead: parseCost(costs.inputCacheRead),
		inputCacheWrite: parseCost(costs.inputCacheWrite),
		output: parseCost(costs.output),
	};
	const hasAny = Object.values(parsed).some((v) => v !== undefined);
	return hasAny ? parsed : undefined;
}
