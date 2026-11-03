import { Outlet } from '@tanstack/react-router';
import styles from './settings-layout.module.css';
import { MobileHeader } from '@/layout/mobile-header';

export function SettingsLayout() {
	return (
		<div className={styles.settingsLayoutDiv}>
			<MobileHeader />
			<Outlet />
		</div>
	);
}
