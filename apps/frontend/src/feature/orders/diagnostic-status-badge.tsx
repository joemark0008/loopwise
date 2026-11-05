import { DIAGNOSTIC_STATUS } from './order-format';
import type { DiagnosticOrderStatus } from '@/graphql/generated/graphql';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';

/** A test's (or an order's) status in words: Requested, Collected, In progress, Resulted, Released, Cancelled. */
export function DiagnosticStatusBadge({ status }: { status: DiagnosticOrderStatus }) {
	const { label, tone } = DIAGNOSTIC_STATUS[status];
	return <ClinicalFlag tone={tone}>{label}</ClinicalFlag>;
}
