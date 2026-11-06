import {
	DISCOUNT_ID_TYPES,
	type InvoiceDraft,
	type OtherDiscountType,
	SC_PWD_DISCOUNT_RATE,
	STATUTORY_DISCOUNT_TYPES,
	type StatutoryDiscountType,
} from '@loopwise/shared/invoice';
import { Injectable } from '@nestjs/common';

import { Prisma, type StaffRole } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { DiscountApproverInvalidError, DiscountIdExpiredError, DiscountIdNotOnFileError } from '../billing.errors.js';
import { manilaDate } from '../billing-dates.js';
import type { InvoiceTotalsResult } from '../invoices/invoice-totals.service.js';
import { InvoiceDiscountRepository } from './invoice-discount.repository.js';

/** Who may approve another discount: the clinic's admins; a SPECIAL discount (doctor's discretion) also a doctor. */
const APPROVER_ROLES: Record<OtherDiscountType, readonly StaffRole[]> = {
	EMPLOYEE: ['SUPER_ADMIN', 'ADMIN'],
	PROMO: ['SUPER_ADMIN', 'ADMIN'],
	SPECIAL: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR'],
};

/** The discounts of a draft, checked, before the amounts are known. */
export interface DiscountPlan {
	statutory: {
		type: StatutoryDiscountType;
		identificationId: string;
		idNumber: string;
		beneficiaryName: string;
	} | null;
	other: {
		type: OtherDiscountType;
		rate: Prisma.Decimal | null;
		amount: Prisma.Decimal | null;
		approvedById: string;
	} | null;
}

/** An `invoice_discounts` row to store (the invoice id is added by the repository). */
export interface DiscountRow {
	type: StatutoryDiscountType | OtherDiscountType;
	rate: Prisma.Decimal;
	amount: Prisma.Decimal;
	vatExempted: Prisma.Decimal;
	beneficiaryName: string | null;
	idNumber: string | null;
	identificationId: string | null;
	approvedById: string | null;
	invoiceLineId: null;
}

/** The patient's SC/PWD ID on file, as the billing desk picks it. */
export interface DiscountIdentificationView {
	id: string;
	discountType: StatutoryDiscountType;
	idNumber: string;
	expiresAt: string | null;
}

/**
 * Invoice discounts with the proof auditors ask for (BIR, DOH). A senior citizen (RA 9994) or PWD (RA 10754) discount
 * needs the patient's OSCA / PWD ID on file, not expired, picked or matched by its number; the row keeps the ID, a
 * snapshot of the beneficiary's name and ID number, and the desk user who checked it (`approved_by_id`). Another
 * discount (employee, promo, special) names an approver allowed to approve it at the clinic. The two are never combined
 * (`InvoiceDraftSchema`).
 */
@Injectable()
export class InvoiceDiscountService {
	constructor(private readonly discounts: InvoiceDiscountRepository) {}

	/** The patient's senior citizen and PWD IDs on file. */
	async identifications(tx: ClinicalTx, patientId: string): Promise<DiscountIdentificationView[]> {
		const rows = await this.discounts.listIdentifications(
			tx,
			patientId,
			STATUTORY_DISCOUNT_TYPES.map((type) => DISCOUNT_ID_TYPES[type]),
		);
		return rows.map((row) => ({
			id: row.id,
			discountType: row.type === 'PWD' ? 'PWD' : 'SENIOR_CITIZEN',
			idNumber: row.idNumber,
			expiresAt: row.expiresAt ? row.expiresAt.toISOString().slice(0, 10) : null,
		}));
	}

	/** Who may approve another discount at the clinic, with the types each may approve. */
	async approvers(
		tx: ClinicalTx,
		clinicId: string,
	): Promise<{ userId: string; name: string; types: OtherDiscountType[] }[]> {
		const staff = await this.discounts.staffWithRoles(tx, clinicId, APPROVER_ROLES.SPECIAL);
		return staff.map((person) => ({
			userId: person.userId,
			name: person.name,
			types: (Object.keys(APPROVER_ROLES) as OtherDiscountType[]).filter((type) =>
				APPROVER_ROLES[type].some((role) => person.roles.includes(role)),
			),
		}));
	}

	/** Checks the draft's discounts against the patient's IDs and the clinic's approvers. */
	async plan(
		tx: ClinicalTx,
		draft: InvoiceDraft,
		visit: { clinicId: string; patientId: string; buyerName: string },
	): Promise<DiscountPlan> {
		let statutory: DiscountPlan['statutory'] = null;
		if (draft.discountType) {
			const ids = await this.identifications(tx, visit.patientId);
			const wanted = draft.discountIdNumber ? normalizeId(draft.discountIdNumber) : null;
			const identification = ids.find(
				(candidate) =>
					candidate.discountType === draft.discountType &&
					(draft.discountIdentificationId
						? candidate.id === draft.discountIdentificationId
						: normalizeId(candidate.idNumber) === wanted),
			);
			if (!identification) {
				throw new DiscountIdNotOnFileError();
			}
			if (identification.expiresAt && identification.expiresAt < manilaDate()) {
				throw new DiscountIdExpiredError();
			}
			statutory = {
				type: draft.discountType,
				identificationId: identification.id,
				idNumber: identification.idNumber,
				beneficiaryName: visit.buyerName,
			};
		}
		let other: DiscountPlan['other'] = null;
		if (draft.otherDiscountType && draft.otherDiscountApprovedById) {
			const approvers = await this.approvers(tx, visit.clinicId);
			const approver = approvers.find((person) => person.userId === draft.otherDiscountApprovedById);
			if (!approver?.types.includes(draft.otherDiscountType)) {
				throw new DiscountApproverInvalidError();
			}
			other = {
				type: draft.otherDiscountType,
				rate:
					draft.otherDiscountPercent === undefined
						? null
						: new Prisma.Decimal(draft.otherDiscountPercent).dividedBy(100),
				amount: draft.otherDiscountAmount === undefined ? null : new Prisma.Decimal(draft.otherDiscountAmount),
				approvedById: approver.userId,
			};
		}
		return { statutory, other };
	}

	/** The rows to store once the totals are computed; `checkedById` is the desk user who checked the SC/PWD ID. */
	rows(plan: DiscountPlan, totals: InvoiceTotalsResult, checkedById: string): DiscountRow[] {
		const rows: DiscountRow[] = [];
		if (plan.statutory) {
			rows.push({
				type: plan.statutory.type,
				rate: new Prisma.Decimal(SC_PWD_DISCOUNT_RATE),
				amount: totals.scPwdDiscount,
				vatExempted: totals.lessVatScPwd,
				beneficiaryName: plan.statutory.beneficiaryName,
				idNumber: plan.statutory.idNumber,
				identificationId: plan.statutory.identificationId,
				approvedById: checkedById,
				invoiceLineId: null,
			});
		}
		if (plan.other) {
			rows.push({
				type: plan.other.type,
				// An amount discount is stored with rate 0: the amount is what was given.
				rate: plan.other.rate ?? new Prisma.Decimal(0),
				amount: totals.otherDiscount,
				vatExempted: new Prisma.Decimal(0),
				beneficiaryName: null,
				idNumber: null,
				identificationId: null,
				approvedById: plan.other.approvedById,
				invoiceLineId: null,
			});
		}
		return rows;
	}
}

const normalizeId = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();
