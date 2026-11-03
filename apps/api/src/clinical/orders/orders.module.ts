import { Module } from '@nestjs/common';

import { FacilityKeysModule } from '../../facility-keys/facility-keys.module.js';
import { OrganizationsModule } from '../../organizations/organizations.module.js';
import { ClinicalAuditModule } from '../audit/clinical-audit.module.js';
import { EncountersModule } from '../encounters/encounters.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { Hl7OutboxController } from './hl7/hl7-outbox.controller.js';
import { Hl7OutboxRepository } from './hl7/hl7-outbox.repository.js';
import { Hl7OutboxService } from './hl7/hl7-outbox.service.js';
import { OrderRepository } from './order.repository.js';
import { OrderService } from './order.service.js';
import { OrdersResolver } from './orders.resolver.js';
import { ORDERS_READER } from './orders-reader.token.js';

/**
 * Clinical orders: ordering from an encounter, the order status lifecycle and the receiving facility's worklist, and
 * outbound HL7 (ORM^O01 through `hl7_outbox`). `OrderService` is exported for the results module (`setResulted`,
 * `setReviewed`) and the HL7 ingest (`applyLabStatus`).
 */
@Module({
	imports: [
		ClinicalDbModule,
		FacilityKeysModule,
		ClinicalAuditModule,
		OrganizationsModule,
		EncountersModule,
		PatientsModule,
		WiseProposalsModule,
	],
	controllers: [Hl7OutboxController],
	providers: [
		OrdersResolver,
		OrderService,
		OrderRepository,
		Hl7OutboxService,
		Hl7OutboxRepository,
		{ provide: ORDERS_READER, useExisting: OrderService },
	],
	exports: [OrderService, Hl7OutboxService, ORDERS_READER],
})
export class OrdersModule {}
