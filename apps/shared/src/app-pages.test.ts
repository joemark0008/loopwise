import { describe, expect, it } from 'vitest';

import { APP_PAGES, appPageHref, describeAppPages, isAppPageKey, parseAppPageParams } from './app-pages';

const PATIENT_ID = '334d301e-8bec-4e38-b6f0-ee218b3e21b0';

describe('app pages registry', () => {
	it('declares every path param in the params schema, and nothing else', () => {
		for (const page of Object.values(APP_PAGES)) {
			const pathParams = [...page.path.matchAll(/\$(\w+)/g)].map((match) => match[1]).sort();
			expect(Object.keys(page.params.shape).sort()).toEqual(pathParams);
		}
	});

	it('knows its keys', () => {
		expect(isAppPageKey('patients.detail')).toBe(true);
		expect(isAppPageKey('admin.secret')).toBe(false);
		expect(isAppPageKey('toString')).toBe(false);
	});

	it('parses the params of a page', () => {
		expect(parseAppPageParams('patients.detail', { patientId: PATIENT_ID })).toEqual({
			success: true,
			params: { patientId: PATIENT_ID },
		});
		expect(parseAppPageParams('patients.list', undefined)).toEqual({ success: true, params: {} });
	});

	it('rejects missing, malformed and extra params', () => {
		expect(parseAppPageParams('patients.detail', {})).toMatchObject({ success: false });
		expect(parseAppPageParams('patients.detail', { patientId: 'maria' })).toMatchObject({
			success: false,
			error: expect.stringContaining('find_patient'),
		});
		expect(parseAppPageParams('patients.list', { patientId: PATIENT_ID })).toMatchObject({ success: false });
	});

	it('builds hrefs', () => {
		expect(appPageHref('patients.detail', { patientId: PATIENT_ID })).toBe(`/patients/${PATIENT_ID}`);
		expect(appPageHref('patients.new', {})).toBe('/patients/new');
	});

	it('describes the pages for the tool', () => {
		expect(describeAppPages()).toContain('patients.detail (Patient chart; params: patientId)');
		expect(describeAppPages()).toContain('patients.list (Patients)');
	});
});
