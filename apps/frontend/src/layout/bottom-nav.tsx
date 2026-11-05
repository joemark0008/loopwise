import { Link } from '@tanstack/react-router';
import styles from './bottom-nav.module.css';
import { useDesks } from '@/hooks/use-staff-role';
import { deskNavLinks } from '@/lib/navigation';

/** Phone navigation: the desk's top-level screens (at most five), each with an icon and a label. */
export function BottomNav() {
	const links = deskNavLinks(useDesks()).slice(0, 5);
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
