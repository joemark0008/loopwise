import { Field, ID, ObjectType } from '@nestjs/graphql';

import type { Supplier } from '../../../../generated/prisma/client.js';

@ObjectType({ description: "A supplier of the organization's medicines and supplies (`suppliers`)." })
export class SupplierModel {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field(() => String, { nullable: true })
	tin: string | null;

	@Field(() => String, { nullable: true })
	address: string | null;

	@Field(() => String, { nullable: true })
	contactPerson: string | null;

	@Field(() => String, { nullable: true })
	contactNo: string | null;

	@Field(() => String, { nullable: true })
	email: string | null;

	@Field(() => String, { nullable: true, description: 'FDA License to Operate (drug distributor).' })
	fdaLtoNo: string | null;

	@Field()
	isActive: boolean;
}

export function toSupplier(row: Supplier): SupplierModel {
	return {
		id: row.id,
		name: row.name,
		tin: row.tin,
		address: row.address,
		contactPerson: row.contactPerson,
		contactNo: row.contactNo,
		email: row.email,
		fdaLtoNo: row.fdaLtoNo,
		isActive: row.isActive,
	};
}
