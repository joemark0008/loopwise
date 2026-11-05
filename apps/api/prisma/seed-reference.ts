import { ICD10_CODES } from '@loopwise/shared/icd10';

import type { Prisma } from '../src/generated/prisma/client.js';

/**
 * Reference data every database needs (dev, demo and the e2e test database): a slice of the PSGC, the curated ICD-10
 * list the UI offers (all of it, so any code the UI suggests satisfies the foreign keys) and a few RVS codes.
 * Idempotent upserts; safe to run on every seed and test setup.
 */
export async function seedReference(tx: Prisma.TransactionClient): Promise<void> {
	await seedPsgc(tx);
	await seedIcd10(tx);
	await seedRvs(tx);
}

// -----------------------------------------------------------------------------
//  PSGC (Philippine Standard Geographic Code, 10-digit codes).
//  TODO(reference data): check every code and name below against the PSA PSGC publication (psa.gov.ph/classification/
//  psgc) before relying on them; they were entered by hand for the demo. Full PSGC import comes with the reference
//  module.
// -----------------------------------------------------------------------------

export const PSGC_REGION_VII = { code: '0700000000', name: 'Region VII (Central Visayas)', shortName: 'VII' };
export const PSGC_BOHOL = { code: '0701200000', name: 'Bohol', regionCode: PSGC_REGION_VII.code };
export const PSGC_TAGBILARAN = {
	code: '0701242000',
	name: 'City of Tagbilaran',
	regionCode: PSGC_REGION_VII.code,
	provinceCode: PSGC_BOHOL.code,
	isCity: true,
	isHuc: false,
	zipCode: '6300',
};

/** The 15 barangays of Tagbilaran City (to be checked against the PSA PSGC publication, see above). */
export const PSGC_TAGBILARAN_BARANGAYS: readonly { code: string; name: string }[] = [
	{ code: '0701242001', name: 'Bool' },
	{ code: '0701242002', name: 'Booy' },
	{ code: '0701242003', name: 'Cabawan' },
	{ code: '0701242004', name: 'Cogon' },
	{ code: '0701242005', name: 'Dao' },
	{ code: '0701242006', name: 'Dampas' },
	{ code: '0701242007', name: 'Manga' },
	{ code: '0701242008', name: 'Mansasa' },
	{ code: '0701242009', name: 'Poblacion I' },
	{ code: '0701242010', name: 'Poblacion II' },
	{ code: '0701242011', name: 'Poblacion III' },
	{ code: '0701242012', name: 'San Isidro' },
	{ code: '0701242013', name: 'Taloto' },
	{ code: '0701242014', name: 'Tiptip' },
	{ code: '0701242015', name: 'Ubujan' },
];

/** The barangay code of a Tagbilaran barangay by name (`Cogon` → `0701242004`), for seeds and fixtures. */
export function tagbilaranBarangayCode(name: string): string {
	const barangay = PSGC_TAGBILARAN_BARANGAYS.find((b) => b.name.toLowerCase() === name.toLowerCase());
	if (!barangay) {
		throw new Error(`Unknown Tagbilaran barangay: ${name}`);
	}
	return barangay.code;
}

async function seedPsgc(tx: Prisma.TransactionClient): Promise<void> {
	const { code: regionCode, ...region } = PSGC_REGION_VII;
	await tx.region.upsert({ where: { code: regionCode }, create: PSGC_REGION_VII, update: region });
	const { code: provinceCode, ...province } = PSGC_BOHOL;
	await tx.province.upsert({ where: { code: provinceCode }, create: PSGC_BOHOL, update: province });
	const { code: cityCode, ...city } = PSGC_TAGBILARAN;
	await tx.cityMunicipality.upsert({ where: { code: cityCode }, create: PSGC_TAGBILARAN, update: city });
	for (const barangay of PSGC_TAGBILARAN_BARANGAYS) {
		await tx.barangay.upsert({
			where: { code: barangay.code },
			create: { ...barangay, cityMunicipalityCode: cityCode },
			update: { name: barangay.name, cityMunicipalityCode: cityCode },
		});
	}
}

// -----------------------------------------------------------------------------
//  ICD-10 (WHO, as PhilHealth uses): the curated list of `@loopwise/shared/icd10`, with the 3-character category as
//  the parent of a subcategory.
// -----------------------------------------------------------------------------

async function seedIcd10(tx: Prisma.TransactionClient): Promise<void> {
	await tx.icd10Code.createMany({
		data: ICD10_CODES.map(({ code, title }) => ({ code, description: title })),
		skipDuplicates: true,
	});
	for (const { code, title } of ICD10_CODES) {
		const parentCode = code.includes('.') ? code.slice(0, 3) : null;
		await tx.icd10Code.update({
			where: { code },
			data: { description: title, parentCode, isActive: true },
		});
	}
}

// -----------------------------------------------------------------------------
//  RVS (PhilHealth Relative Value Scale): a few minor outpatient procedures. TODO(reference data): check the codes and
//  descriptions against the PhilHealth RVS publication; RVUs are left blank until then.
// -----------------------------------------------------------------------------

export const RVS_CODES: readonly { code: string; description: string }[] = [
	{ code: '10060', description: 'Incision and drainage of abscess; simple or single' },
	{ code: '10120', description: 'Incision and removal of foreign body, subcutaneous tissues; simple' },
	{ code: '12001', description: 'Simple repair of superficial wounds; 2.5 cm or less' },
	{ code: '11730', description: 'Avulsion of nail plate, partial or complete, simple; single' },
	{ code: '69210', description: 'Removal of impacted cerumen, one or both ears' },
];

async function seedRvs(tx: Prisma.TransactionClient): Promise<void> {
	for (const { code, description } of RVS_CODES) {
		await tx.rvsCode.upsert({ where: { code }, create: { code, description }, update: { description } });
	}
}
