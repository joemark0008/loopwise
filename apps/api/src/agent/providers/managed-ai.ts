/**
 * Upstream's managed AI (the provider billed against cloud credits) is not ported: loopwise has no
 * billing. The usage context type stays because model resolution and telemetry carry it.
 */
export interface ManagedAiUsageContext {
	userId: string;
	clinicId: string;
	chatId?: string;
	messageId?: string;
	runId: string;
	category: string;
	billingMode: 'wallet' | 'unbilled';
}
