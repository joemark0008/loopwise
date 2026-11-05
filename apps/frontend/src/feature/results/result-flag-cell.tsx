import { FileText } from 'lucide-react';
import type { DiagnosticReportFieldsFragment } from '@/graphql/generated/graphql';
import { ClinicalFlag, ResultFlagChip } from '@/components/clinical/clinical-flag';

/** The result's worst flag in words with its icon; a result without flags (a report) says so. */
export function ResultFlagCell({ result }: { result: Pick<DiagnosticReportFieldsFragment, 'flag'> }) {
	return result.flag ? (
		<ResultFlagChip flag={result.flag} />
	) : (
		<ClinicalFlag tone='info' icon={FileText}>
			No flag
		</ClinicalFlag>
	);
}
