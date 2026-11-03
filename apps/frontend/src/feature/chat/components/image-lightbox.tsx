import { useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './image-lightbox.module.css';

interface ImageLightboxProps {
	src: string;
	onClose: () => void;
}

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		},
		[onClose],
	);

	useEffect(() => {
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [handleKeyDown]);

	return (
		<div className={styles.imageLightboxDiv} onClick={onClose}>
			<button
				type='button'
				onClick={(e) => {
					e.stopPropagation();
					onClose();
				}}
				className={styles.imageLightboxButton}
			>
				<X className={styles.imageLightboxX} />
			</button>
			<img src={src} alt='' className={styles.imageLightboxImg} onClick={(e) => e.stopPropagation()} />
		</div>
	);
}
