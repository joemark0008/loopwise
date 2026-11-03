import styles from './brand-gradient-backdrop.module.css';
import type { CSSProperties } from 'react';

type BrandGradientBackdropProps = {
	color: string;
	className?: string;
	style?: CSSProperties;
};

/** Brand-coloured backdrop for the auth side panel: the colour with a soft light sweep. */
export function BrandGradientBackdrop({ color, className, style }: BrandGradientBackdropProps) {
	return (
		<div
			className={className}
			style={{ backgroundColor: color, isolation: 'isolate', ...style }}
			aria-hidden='true'
		>
			<div
				className={styles.brandGradientBackdropDiv}
				style={{
					backgroundImage:
						'radial-gradient(120% 90% at 85% 100%, rgba(255,255,255,0.45), transparent 60%), radial-gradient(80% 70% at 30% 10%, rgba(255,255,255,0.18), transparent 70%)',
					mixBlendMode: 'screen',
				}}
			/>
		</div>
	);
}
