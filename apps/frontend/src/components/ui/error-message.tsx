import styles from './error-message.module.css';

export function ErrorMessage({ message }: { message: string }) {
	return <div className={styles.errorMessageDiv}>{message}</div>;
}
