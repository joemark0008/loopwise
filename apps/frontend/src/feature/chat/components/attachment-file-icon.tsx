import { fileExtension } from '@loopwise/shared/attachments';
import { FileCode, FileJson, FileSpreadsheet, FileText, FileType } from 'lucide-react';

import styles from './attachment-file-icon.module.css';
import { cn } from '@/lib/utils';

const ICONS = {
	csv: FileSpreadsheet,
	tsv: FileSpreadsheet,
	xls: FileSpreadsheet,
	xlsx: FileSpreadsheet,
	parquet: FileSpreadsheet,
	json: FileJson,
	jsonl: FileJson,
	yaml: FileCode,
	yml: FileCode,
	xml: FileCode,
	html: FileCode,
	sql: FileCode,
	pdf: FileType,
	docx: FileType,
} as const;

const COLORS = {
	csv: styles.cOLORSCsv,
	tsv: styles.cOLORSCsv,
	xls: styles.cOLORSCsv,
	xlsx: styles.cOLORSCsv,
	parquet: styles.cOLORSCsv,
	json: styles.cOLORSJson,
	jsonl: styles.cOLORSJson,
	pdf: styles.cOLORSPdf,
	docx: styles.cOLORSDocx,
} as const;

export function AttachmentFileIcon({ fileName, className }: { fileName: string; className?: string }) {
	const extension = fileExtension(fileName) as keyof typeof ICONS;
	const Icon = ICONS[extension] ?? FileText;
	const color = COLORS[extension as keyof typeof COLORS] ?? styles.color;

	return <Icon className={cn(color, className)} />;
}
