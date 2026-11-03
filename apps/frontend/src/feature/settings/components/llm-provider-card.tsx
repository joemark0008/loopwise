import { Pencil, Trash2 } from 'lucide-react';
import { getDefaultModelId, getProviderAuth } from '@loopwise/api/agent/providers/provider-meta';
import { providerKind, providerLabel, providerLabels, providerName } from '@loopwise/shared/types';
import styles from './llm-provider-card.module.css';
import type { LlmProvider } from '@loopwise/shared/types';
import { LlmProviderIcon } from '@/components/ui/llm-provider-icon';
import { Button } from '@/components/ui/button';

interface ProviderCardProps {
	provider: LlmProvider;
	apiKeyPreview?: string | null;
	credentialPreviews?: Record<string, string> | null;
	baseUrl?: string | null;
	envBaseUrl?: string;
	enabledModels?: string[] | null;
	status?: string;
	/** Where this provider comes from, e.g. `ENV` or `loopwise_config.yaml`. */
	badges?: string[];
	isAdmin: boolean;
	isFormActive: boolean;
	onEdit?: () => void;
	onDelete?: () => void;
	isDeleting?: boolean;
	getModelDisplayName: (provider: LlmProvider, modelId: string) => string;
}

export function ProviderCard({
	provider,
	apiKeyPreview,
	credentialPreviews,
	baseUrl,
	envBaseUrl,
	enabledModels,
	status,
	badges = [],
	isAdmin,
	isFormActive,
	onEdit,
	onDelete,
	isDeleting,
	getModelDisplayName,
}: ProviderCardProps) {
	return (
		<div className={styles.providerCardDiv}>
			<div className={styles.providerCardDiv2}>
				<div className={styles.providerCardDiv3}>
					<div className={styles.providerCardDiv4}>
						<LlmProviderIcon
							provider={provider}
							baseUrl={baseUrl || envBaseUrl}
							className={styles.providerCardLlmProviderIcon}
						/>
						<span className={styles.providerCardSpan}>{providerLabel(provider)}</span>
						{providerName(provider) && (
							<span className={styles.providerCardSpan2}>{providerLabels[providerKind(provider)]}</span>
						)}
						{badges.map((badge) => (
							<span key={badge} className={styles.providerCardSpan3}>
								{badge}
							</span>
						))}
					</div>
					{apiKeyPreview || credentialPreviews ? (
						<div className={styles.providerCardDiv5}>
							{apiKeyPreview && <span className={styles.providerCardSpan4}>{apiKeyPreview}</span>}
							{credentialPreviews &&
								Object.entries(credentialPreviews).map(([key, preview]) => (
									<span key={key} className={styles.providerCardSpan4}>
										{key}: {preview}
									</span>
								))}
							{(baseUrl || envBaseUrl) && (
								<>
									<span className={styles.providerCardSpan5}>•</span>
									<span className={styles.providerCardSpan6} title={baseUrl || envBaseUrl}>
										{baseUrl || envBaseUrl}
									</span>
								</>
							)}
						</div>
					) : (
						<div className={styles.providerCardDiv6}>
							<span>
								{status ??
									(getProviderAuth(provider).apiKey === 'required'
										? 'API key from environment'
										: getProviderAuth(provider).apiKey === 'optional'
											? 'Using credentials from environment'
											: 'No API key required')}
							</span>
							{envBaseUrl && (
								<>
									<span className={styles.providerCardSpan5}>•</span>
									<span className={styles.providerCardSpan6} title={envBaseUrl}>
										{envBaseUrl}
									</span>
								</>
							)}
						</div>
					)}
				</div>
				{isAdmin && (onEdit || onDelete) && (
					<div className={styles.providerCardDiv7}>
						{onEdit && (
							<Button variant='ghost' size='icon-sm' onClick={onEdit} disabled={isFormActive}>
								<Pencil className={styles.providerCardPencil} />
							</Button>
						)}
						{onDelete && (
							<Button
								variant='ghost'
								size='icon-sm'
								onClick={onDelete}
								disabled={isDeleting || isFormActive}
							>
								<Trash2 className={styles.providerCardTrash2} />
							</Button>
						)}
					</div>
				)}
			</div>
			<div className={styles.providerCardDiv8}>
				{enabledModels && enabledModels.length > 0 ? (
					<>
						<span className={styles.providerCardSpan2}>Enabled models:</span>
						<div className={styles.providerCardDiv9}>
							{enabledModels.map((modelId) => (
								<span key={modelId} className={styles.providerCardSpan7}>
									{getModelDisplayName(provider, modelId)}
								</span>
							))}
						</div>
					</>
				) : getDefaultModelId(provider) ? (
					<span className={styles.providerCardSpan2}>Default model: {getDefaultModelId(provider)}</span>
				) : (
					<span className={styles.providerCardSpan2}>No model yet — add one to use this provider</span>
				)}
			</div>
		</div>
	);
}
