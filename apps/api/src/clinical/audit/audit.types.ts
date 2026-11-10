import type { AuditAction, Prisma } from '../../generated/prisma/client.js';

/**
 * What an audit row is about: the Prisma model name of the entity (`Patient`, `Encounter`, `DiagnosticOrder`,
 * `Invoice` …). A free string is allowed for things that are not a table (`AnalyticsQuery`, `Report`).
 */
export type AuditEntityType = Prisma.ModelName | (string & {});

/** The before/after picture of a change (`audit_logs.changes`); see `auditChanges()` to keep only what changed. */
export interface AuditChanges {
	before?: Prisma.InputJsonValue | null;
	after?: Prisma.InputJsonValue | null;
}

/** Where the request came from, read from the request context unless given (jobs, tests). */
export interface AuditRequestMeta {
	requestId?: string | null;
	ipAddress?: string | null;
	userAgent?: string | null;
}

/** One audit row (`audit_logs`, RA 10173 / NPC: who viewed or changed which patient data, when, from where). */
export interface AuditEntry {
	/** The base schema's coarse verb: CREATE, UPDATE, VIEW, SIGN, VOID, PRINT, EXPORT … */
	action: AuditAction;
	/**
	 * Loopwise's specific event, `<entity>.<verb>` in snake_case: `patient.view`, `result.review`,
	 * `prescription.issue`, `invoice.void`, `analytics.query.rejected`. Tests and the "who viewed my record" screens
	 * match on it, so keep a name once it is used.
	 */
	event: string;
	entityType: AuditEntityType;
	entityId?: string | null;
	/**
	 * Who did it. Inside `ClinicalDbService.asUser(userId, …)` it must be that same user (the `audit_logs_own` policy);
	 * `null` only for system work (run on an `asSystem` transaction), with `origin` saying what acted.
	 */
	userId: string | null;
	/** The patient the row concerns, when any: it drives the patient's access history. */
	patientId?: string | null;
	organizationId?: string | null;
	clinicId?: string | null;
	changes?: AuditChanges | null;
	/** Why (a break-glass justification, a void reason, a review note). */
	reason?: string | null;
	/**
	 * Where the action came from when not the app's own forms: a confirmed Wise card
	 * (`{ via: 'wise', toolName, chatId, messageId, toolCallId, edited }`) or system work (`{ via: 'job', name }`).
	 */
	origin?: Prisma.InputJsonObject | null;
	/** Overrides for the request context (request id, ip, user agent). */
	request?: AuditRequestMeta;
}
