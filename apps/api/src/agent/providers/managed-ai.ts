/**
 * Upstream's managed AI (the provider billed against cloud credits) is not ported: quarry has no
 * billing. The usage context type stays because model resolution and telemetry carry it.
 */
export interface ManagedAiUsageContext {
	userId: string;
	projectId: string;
	chatId?: string;
	messageId?: string;
	runId: string;
	category: string;
	billingMode: 'wallet' | 'unbilled';
}
