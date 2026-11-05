import { HandlerError, type HandlerErrorCode } from './handler-error.js';

/** Extra facts a client may act on (ids, the status found). Sent as `extensions.details`; never patient data. */
export type DomainErrorDetails = Readonly<Record<string, string | number | boolean | null>>;

/**
 * The base of the clinical modules' domain errors: a business rule said no. It is a `HandlerError`, so the global
 * filter maps it like one (`kind` sets `extensions.code` / the HTTP status the frontend already understands), and adds
 * the stable, specific `errorCode` (`extensions.errorCode`, REST `errorCode`) a client or a test can match on.
 *
 * Subclass it per rule, named after it, with a SCREAMING_SNAKE code:
 *
 * ```ts
 * export class InvoiceAlreadyIssuedError extends DomainError {
 *     constructor(invoiceNo: string) {
 *         super('CONFLICT', 'INVOICE_ALREADY_ISSUED', `Invoice ${invoiceNo} is already issued.`, { invoiceNo });
 *     }
 * }
 * ```
 *
 * The message is shown to the user as is: plain words, no stack, no SQL, no patient data beyond what they can see.
 */
export class DomainError extends HandlerError {
	/** Stable machine-readable code, e.g. `INVOICE_ALREADY_ISSUED`. */
	readonly errorCode: string;
	readonly details?: DomainErrorDetails;

	constructor(kind: HandlerErrorCode, errorCode: string, message: string, details?: DomainErrorDetails) {
		super(kind, message);
		this.name = new.target.name;
		this.errorCode = errorCode;
		this.details = details;
	}

	/** The generic class of the error (`NOT_FOUND`, `CONFLICT` …): `extensions.code`. */
	get kind(): HandlerErrorCode {
		return this.codeMessage;
	}
}

/** A record the user asked for doesn't exist, or row-level security hides it (the two are not told apart). */
export class EntityNotFoundError extends DomainError {
	constructor(entityType: string, id?: string | null) {
		super('NOT_FOUND', 'ENTITY_NOT_FOUND', `${humanize(entityType)} not found.`, {
			entityType,
			...(id ? { id } : {}),
		});
	}
}

/** A status machine refused a move (the TypeScript mirror of a trigger such as `check_diagnostic_order_transition`). */
export class InvalidStatusTransitionError extends DomainError {
	constructor(entityType: string, from: string, to: string) {
		super('CONFLICT', 'INVALID_STATUS_TRANSITION', `${humanize(entityType)} cannot go from ${from} to ${to}.`, {
			entityType,
			from,
			to,
		});
	}
}

/** Someone else saved the row first (optimistic locking on a `version` column). Reload and try again. */
export class StaleVersionError extends DomainError {
	constructor(entityType: string, expected: number, actual?: number) {
		super(
			'CONFLICT',
			'STALE_VERSION',
			`${humanize(entityType)} was changed by someone else. Reload it and try again.`,
			{ entityType, expected, ...(actual === undefined ? {} : { actual }) },
		);
	}
}

/** The user is signed in but a clinical rule keeps them out (no care relationship, wrong desk role). */
export class ClinicalAccessDeniedError extends DomainError {
	constructor(message = 'You do not have access to this record.', details?: DomainErrorDetails) {
		super('FORBIDDEN', 'CLINICAL_ACCESS_DENIED', message, details);
	}
}

/** `DiagnosticOrder` → `Diagnostic order`. */
function humanize(entityType: string): string {
	const words = entityType.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}
