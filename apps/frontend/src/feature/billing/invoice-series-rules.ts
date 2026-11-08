import type { InvoiceSeriesState } from '@/graphql/generated/graphql';

interface SeriesLike {
	id: string;
	docType: string;
	isActive: boolean;
	state: InvoiceSeriesState;
}

/**
 * Whether turning `target` off leaves its document type with no usable series. Issuing then stops: the API refuses
 * (`INVOICE_SERIES_INACTIVE` / `_EXHAUSTED` / `_EXPIRED`) rather than print a number outside a registered range.
 */
export function isLastUsableSeries(all: readonly SeriesLike[], target: SeriesLike): boolean {
	if (!target.isActive || target.state !== 'ACTIVE') {
		return false;
	}
	return !all.some((row) => row.id !== target.id && row.docType === target.docType && row.state === 'ACTIVE');
}
