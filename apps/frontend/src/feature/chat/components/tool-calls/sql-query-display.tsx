import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';

import styles from './sql-query-display.module.css';
import { cn } from '@/lib/utils';

interface SqlQueryDisplayProps {
	query: string;
	className?: string;
}

export function SqlQueryDisplay({ query, className }: SqlQueryDisplayProps) {
	return (
		<div className={cn(`${styles.sqlQueryDisplayDiv} hide-code-header`, className)}>
			<Streamdown className='sql-query-display' mode='static' controls={{ code: false }} plugins={{ code }}>
				{`\`\`\`sql\n${query.trim()}\n\`\`\``}
			</Streamdown>
		</div>
	);
}
