import type { Prisma } from '../../generated/prisma/client.js';
import type { AuditChanges } from './audit.types.js';

type Row = Record<string, unknown>;

/**
 * The `changes` of an UPDATE audit row: only the fields whose value differs between `before` and `after` (optionally
 * restricted to `fields`), each side as JSON (dates as ISO strings, Decimals as strings). `null` when nothing changed.
 * Pass whole rows; bookkeeping columns (`updatedAt`, `version`) are left out.
 */
export function auditChanges<T extends Row>(
	before: T | null | undefined,
	after: T | null | undefined,
	fields?: readonly (keyof T & string)[],
): AuditChanges | null {
	const keys = fields ?? [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
	const changedBefore: Row = {};
	const changedAfter: Row = {};
	for (const key of keys) {
		if (IGNORED_FIELDS.has(key)) {
			continue;
		}
		const was = toJson(before?.[key]);
		const now = toJson(after?.[key]);
		if (JSON.stringify(was) !== JSON.stringify(now)) {
			changedBefore[key] = was;
			changedAfter[key] = now;
		}
	}
	if (Object.keys(changedAfter).length === 0) {
		return null;
	}
	return {
		before: before ? (changedBefore as Prisma.InputJsonObject) : null,
		after: after ? (changedAfter as Prisma.InputJsonObject) : null,
	};
}

/** A whole row as the `after` of a CREATE (or the `before` of a DELETE) audit row, minus bookkeeping columns. */
export function auditSnapshot(row: Row): Prisma.InputJsonObject {
	const snapshot: Row = {};
	for (const [key, value] of Object.entries(row)) {
		if (!IGNORED_FIELDS.has(key)) {
			snapshot[key] = toJson(value);
		}
	}
	return snapshot as Prisma.InputJsonObject;
}

const IGNORED_FIELDS = new Set(['createdAt', 'updatedAt', 'version']);

function toJson(value: unknown): unknown {
	if (value === undefined) {
		return null;
	}
	// Dates, Prisma Decimals and nested objects through their JSON form.
	return JSON.parse(JSON.stringify(value)) as unknown;
}
