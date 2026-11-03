import * as React from 'react';

import styles from './textarea.module.css';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return <textarea data-slot='textarea' className={cn(styles.textareaTextarea, className)} {...props} />;
}

export { Textarea };
