import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { text } from '../../../common/input-values.js';
import type { Supplier } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../../audit/audit-changes.js';
import type { ClinicActor } from '../../clinics/clinic-admin-actor.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import type { SaveSupplierInput } from './dto/supplier.input.js';
import { type SupplierModel, toSupplier } from './models/supplier.model.js';
import { SupplierRepository } from './supplier.repository.js';

/**
 * The organization's suppliers (Pharmacy → Suppliers) with their FDA License to Operate: read by the pharmacy and
 * stock room, written by the stock room and admins, as the user. Audited.
 */
@Injectable()
export class SupplierService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly suppliers: SupplierRepository,
		private readonly audit: AuditService,
	) {}

	list(actor: ClinicActor, includeInactive: boolean): Promise<SupplierModel[]> {
		return this.db.asUser(actor.userId, async (tx) =>
			(await this.suppliers.list(tx, actor.organizationId, includeInactive)).map(toSupplier),
		);
	}

	save(actor: ClinicActor, input: SaveSupplierInput): Promise<SupplierModel> {
		const data = {
			name: input.name.trim(),
			tin: text(input.tin),
			address: text(input.address),
			contactPerson: text(input.contactPerson),
			contactNo: text(input.contactNo),
			email: text(input.email),
			fdaLtoNo: text(input.fdaLtoNo),
			isActive: input.isActive,
		};
		return this.db.asUser(actor.userId, async (tx) => {
			const before = input.id ? await this.require(tx, actor, input.id) : null;
			const row = before
				? await this.suppliers.update(tx, before.id, data)
				: await this.suppliers.create(tx, { ...data, organizationId: actor.organizationId });
			await this.audit.record(tx, {
				action: before ? 'UPDATE' : 'CREATE',
				event: before ? 'supplier.update' : 'supplier.create',
				entityType: 'Supplier',
				entityId: row.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: before
					? auditChanges({ ...toSupplier(before) }, { ...toSupplier(row) })
					: { after: auditSnapshot({ ...toSupplier(row) }) },
			});
			return toSupplier(row);
		});
	}

	/** A supplier of the actor's organization (else not found). */
	async require(tx: ClinicalTx, actor: Pick<ClinicActor, 'organizationId'>, id: string): Promise<Supplier> {
		const row = await this.suppliers.find(tx, id);
		if (!row || row.organizationId !== actor.organizationId) {
			throw new EntityNotFoundError('Supplier', id);
		}
		return row;
	}
}
