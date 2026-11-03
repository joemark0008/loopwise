import { ModelParametersFields } from './model-parameters-fields';
import { useModelParameters } from './use-model-parameters';
import styles from './model-parameters-dialog.module.css';
import type { ModelInferenceSettings } from '@loopwise/api/agent/types/llm';
import type { LlmProvider } from '@loopwise/shared/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ModelParametersDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	provider: LlmProvider;
	model: { id: string; name: string };
	value: ModelInferenceSettings | undefined;
	onSave: (settings: ModelInferenceSettings) => void;
}

export function ModelParametersDialog({
	open,
	onOpenChange,
	provider,
	model,
	value,
	onSave,
}: ModelParametersDialogProps) {
	const { controls, values, setValue, errors, hasErrors, buildSettings } = useModelParameters({
		provider,
		modelId: model.id,
		open,
		value,
	});

	const handleSave = () => {
		if (hasErrors) {
			return;
		}
		onSave(buildSettings());
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={styles.modelParametersDialogDialogContent}>
				<DialogHeader>
					<DialogTitle>Model parameters</DialogTitle>
					<DialogDescription className={styles.modelParametersDialogDialogDescription}>
						{model.name}
					</DialogDescription>
				</DialogHeader>

				<ModelParametersFields controls={controls} values={values} errors={errors} onValueChange={setValue} />

				<div className={styles.modelParametersDialogDiv}>
					<Button variant='ghost' size='sm' onClick={() => onOpenChange(false)} type='button'>
						Cancel
					</Button>
					<Button size='sm' onClick={handleSave} type='button' disabled={hasErrors}>
						Save
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
