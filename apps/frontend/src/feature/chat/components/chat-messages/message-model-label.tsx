import { providerLabel } from '@quarry/shared/types';
import styles from './message-model-label.module.css';
import type { MessageModel } from '@quarry/api/agent/types/chat';
import { LlmProviderIcon } from '@/components/ui/llm-provider-icon';
import { SimpleTooltip } from '@/components/ui/tooltip';

export function MessageModelLabel({ model }: { model: MessageModel }) {
	return (
		<SimpleTooltip content={<MessageModelDetails model={model} />} side='bottom' align='start'>
			<span className={styles.messageModelLabelSpan}>
				<LlmProviderIcon provider={model.provider} className={styles.messageModelLabelLlmProviderIcon} />
				{model.name}
			</span>
		</SimpleTooltip>
	);
}

export function MessageModelDetails({ model }: { model: MessageModel }) {
	return (
		<span>
			{providerLabel(model.provider)} · <span className={styles.messageModelDetailsSpan}>{model.modelId}</span>
		</span>
	);
}
