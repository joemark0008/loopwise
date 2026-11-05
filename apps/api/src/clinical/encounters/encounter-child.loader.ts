import { LoaderFactory } from '../../common/dataloader/loader-factory.js';
import type { ClinicalDbService, ClinicalTx } from '../rls/clinical-db.service.js';

/** The loader key of an encounter's records as one user may see them. */
export const userEncounterKey = (userId: string, encounterId: string): string => `${userId}:${encounterId}`;

/**
 * Base of the DataLoaders that read an encounter child (prescriptions, certificates, orders, invoices …) for many
 * encounters at once, as the user (row-level security): the chart's visit list asks for each visit's records in one
 * query per kind. A module adds a field to `PatientVisit` / `EncounterRecord` with a loader like:
 *
 * ```ts
 * @Injectable()
 * export class EncounterPrescriptionsLoader extends UserEncounterLoader<Prescription> {
 *     constructor(db: ClinicalDbService, private readonly prescriptions: PrescriptionRepository) { super(db); }
 *     protected async load(tx, encounterIds) { return groupByEncounter(await this.prescriptions.listFor(tx, encounterIds)); }
 * }
 * ```
 *
 * and loads with `loaders.get(EncounterPrescriptionsLoader).load(userEncounterKey(user.id, encounter.id))`.
 */
export abstract class UserEncounterLoader<V> extends LoaderFactory<string, V[]> {
	protected constructor(protected readonly db: ClinicalDbService) {
		super();
	}

	/** The rows of each encounter in `encounterIds`, read on the user's transaction. */
	protected abstract load(tx: ClinicalTx, encounterIds: readonly string[]): Promise<Map<string, V[]>>;

	async batch(keys: readonly string[]): Promise<V[][]> {
		const byUser = new Map<string, string[]>();
		for (const key of keys) {
			const [userId, encounterId] = key.split(':');
			byUser.set(userId, [...(byUser.get(userId) ?? []), encounterId]);
		}
		const found = new Map<string, V[]>();
		for (const [userId, encounterIds] of byUser) {
			const rows = await this.db.asUser(userId, (tx) => this.load(tx, encounterIds));
			for (const encounterId of encounterIds) {
				found.set(userEncounterKey(userId, encounterId), rows.get(encounterId) ?? []);
			}
		}
		return keys.map((key) => found.get(key) ?? []);
	}
}

/** Groups rows by their `encounterId`, keeping their order. */
export function groupByEncounter<T>(rows: readonly T[], encounterIdOf: (row: T) => string): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	for (const row of rows) {
		const encounterId = encounterIdOf(row);
		groups.set(encounterId, [...(groups.get(encounterId) ?? []), row]);
	}
	return groups;
}
