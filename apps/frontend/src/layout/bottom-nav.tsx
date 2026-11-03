import { Link } from '@tanstack/react-router';
import styles from './bottom-nav.module.css';
import { useStaffRole } from '@/hooks/use-staff-role';
import { roleNavLinks } from '@/lib/navigation';

/** Phone navigation: the role's top-level screens (at most five), each with an icon and a label. */
export function BottomNav() {
	const links = roleNavLinks(useStaffRole()).slice(0, 5);
	return (
		<nav className={styles.bar} aria-label='Main'>
			{links.map(({ to, label, icon: Icon, exact }) => (
				<Link
					key={to}
					to={to}
					className={styles.item}
					activeOptions={{ exact: exact ?? false }}
					activeProps={{ 'aria-current': 'page' }}
				>
					<Icon aria-hidden />
					<span>{label}</span>
				</Link>
			))}
		</nav>
	);
}
