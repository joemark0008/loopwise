import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { memo } from 'react';
import styles from './find-patient.module.css';
import type { findPatient } from '@loopwise/shared/tools';
import type { ToolCallComponentProps } from '.';
import { ErrorMessage } from '@/components/ui/error-message';
import { useAgentContext } from '@/contexts/agent.provider';
import { formatDay } from '@/feature/encounters/encounter-format';
import { ageLabel } from '@/feature/patients/patient-format';

/** Wise's `find_patient` (DESIGN.md §7.2): the matches, each linking to the patient's chart. */
export const FindPatientToolCall = memo(({ toolPart }: ToolCallComponentProps<'find_patient'>) => {
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	if (toolPart.state !== 'output-available' || !toolPart.output) {
		return null;
	}
	return <PatientMatches query={searchLabel(toolPart.input)} output={toolPart.output} />;
});

export function PatientMatches({ query, output }: { query: string; output: findPatient.Output }) {
	const { chatId } = useAgentContext();
	return (
		<div className={styles.findPatient} data-testid='find-patient'>
			<div className={styles.findPatientHeader}>
				<Search />
				<span>
					{output.patients.length === 0
						? `No patients found for ${query}`
						: `${output.patients.length}${output.truncated ? '+' : ''} found for ${query}`}
				</span>
			</div>
			{output.patients.length > 0 && (
				<ul className={styles.findPatientList}>
					{output.patients.map((patient) => (
						<li key={patient.id}>
							<Link
								to='/patients/$patientId'
								params={{ patientId: patient.id }}
								state={{ fromChatId: chatId }}
								className={styles.findPatientRow}
							>
								<span className={styles.findPatientName}>{patient.name}</span>
								<span className={styles.findPatientMeta}>
									{[
										ageLabel(patient.birthDate, patient.sex),
										`born ${formatDay(patient.birthDate)}`,
										...patient.identifiers.map(({ system, value }) => `${system} ${value}`),
									]
										.filter(Boolean)
										.join(' · ')}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

const searchLabel = (input: Partial<findPatient.Input> | undefined) =>
	[input?.query?.trim() && `“${input.query.trim()}”`, input?.birthDate && `born ${input.birthDate}`]
		.filter(Boolean)
		.join(', ') || 'the search';
