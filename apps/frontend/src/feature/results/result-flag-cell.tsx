import { FileText } from 'lucide-react';
import type { ResultItemFieldsFragment } from '@/graphql/generated/graphql';
import { ClinicalFlag, ResultFlagChip } from '@/components/clinical/clinical-flag';

/** The flag in words with its icon; results the lab sent without a flag (reports) say so. */
export function ResultFlagCell({ result }: { result: Pick<ResultItemFieldsFragment, 'flag'> }) {
	return result.flag ? (
		<ResultFlagChip flag={result.flag} />
	) : (
		<ClinicalFlag tone='info' icon={FileText}>
			No flag
		</ClinicalFlag>
	);
}
