import { DEFAULT_PF_EWT_RATE } from '@loopwise/shared/invoice';

import { Prisma } from '../../../generated/prisma/client.js';
import { centavos } from '../invoices/invoice-totals.service.js';

type Decimal = Prisma.Decimal;

export interface ProfessionalFeeAmounts {
	grossAmount: Decimal;
	clinicShare: Decimal;
	ewtRate: Decimal;
	ewtAmount: Decimal;
	netPayable: Decimal;
}

/**
 * A doctor's fee from an issued invoice line, each step rounded half up to the centavo:
 * gross = the line as billed, net of VAT (after any SC/PWD or other discount, which the fee bears);
 * clinic share = gross × the doctor's clinic share rate; EWT = (gross − clinic share) × the doctor's EWT rate (10%
 * unless set: 5% / 10% / 15% under BIR rules, confirmed by the clinic's accountant); net payable = the rest.
 */
export function professionalFeeAmounts(
	line: { lineTotal: Decimal; vatAmount: Decimal },
	terms: { ewtRate: Decimal | null; clinicShareRate: Decimal } | null,
): ProfessionalFeeAmounts {
	const grossAmount = line.lineTotal.minus(line.vatAmount);
	const clinicShare = centavos(grossAmount.times(terms?.clinicShareRate ?? 0));
	const ewtRate = terms?.ewtRate ?? new Prisma.Decimal(DEFAULT_PF_EWT_RATE);
	const ewtAmount = centavos(grossAmount.minus(clinicShare).times(ewtRate));
	return {
		grossAmount,
		clinicShare,
		ewtRate,
		ewtAmount,
		netPayable: grossAmount.minus(clinicShare).minus(ewtAmount),
	};
}
