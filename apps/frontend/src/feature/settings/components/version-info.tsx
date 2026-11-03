import { useQuery } from '@apollo/client/react';

import styles from './version-info.module.css';
import { AppVersionDocument } from '@/graphql/generated/graphql';

export function SettingsVersionInfo() {
	const versionInfo = useQuery(AppVersionDocument);

	const version = versionInfo.data?.version.version;
	const commit = versionInfo.data?.version.commit;
	const buildDate = versionInfo.data?.version.buildDate;

	return (
		<div className={styles.settingsVersionInfoDiv}>
			<div className={styles.settingsVersionInfoDiv2}>
				<span className={styles.settingsVersionInfoSpan}>Version</span>
				<span className={styles.settingsVersionInfoSpan2}>{version ?? 'unknown'}</span>
				<span className={styles.settingsVersionInfoSpan}>Commit</span>
				<span className={styles.settingsVersionInfoSpan2}>{commit ?? 'unknown'}</span>
				<span className={styles.settingsVersionInfoSpan}>Build date</span>
				<span className={styles.settingsVersionInfoSpan2}>{buildDate || 'unknown'}</span>
			</div>
		</div>
	);
}
