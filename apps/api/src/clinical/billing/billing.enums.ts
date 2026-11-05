import { registerEnumType } from '@nestjs/graphql';

import {
	DiscountType,
	InvoiceDocType,
	InvoiceStatus,
	PaymentMethod,
	PaymentStatus,
	ServiceCategory,
	TaxType,
} from '../../generated/prisma/enums.js';

/** The billing domain's enums, as the schema names them (`billing.prisma`), registered once for GraphQL. */
registerEnumType(InvoiceStatus, {
	name: 'InvoiceStatus',
	description: 'DRAFT (editable), ISSUED (numbered and locked), PARTIALLY_PAID, PAID, VOID.',
});
registerEnumType(InvoiceDocType, { name: 'InvoiceDocType' });
registerEnumType(TaxType, {
	name: 'TaxType',
	description: 'VATABLE (12% VAT included in the price), VAT_EXEMPT, ZERO_RATED.',
});
registerEnumType(ServiceCategory, { name: 'ServiceCategory' });
registerEnumType(DiscountType, {
	name: 'DiscountType',
	description: 'SENIOR_CITIZEN (RA 9994) and PWD (RA 10754): 20% plus VAT exemption.',
});
registerEnumType(PaymentMethod, { name: 'PaymentMethod' });
registerEnumType(PaymentStatus, { name: 'PaymentStatus' });

export { DiscountType, InvoiceDocType, InvoiceStatus, PaymentMethod, PaymentStatus, ServiceCategory, TaxType };
