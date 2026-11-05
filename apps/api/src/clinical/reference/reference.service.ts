import { normalizeIcd10Code, searchIcd10 } from '@loopwise/shared/icd10';
import { Injectable } from '@nestjs/common';

import type { Barangay as BarangayRow } from '../../generated/prisma/client.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import type { Barangay, CityMunicipality, Icd10Code } from './models/reference.model.js';
import { UnknownBarangayError, UnknownCityMunicipalityError, UnknownIcd10CodeError } from './reference.errors.js';
import { type CityMunicipalityRow, ReferenceRepository } from './reference.repository.js';

/**
 * Reference data shared by the clinical modules: ICD-10 codes (`icd10_codes`, the code list of PhilHealth claims) and
 * PSGC barangays. Suggestions come from the curated primary-care list of `@loopwise/shared/icd10`; every code of it is
 * seeded into `icd10_codes`, which is what a diagnosis is checked against.
 */
@Injectable()
export class ReferenceService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly reference: ReferenceRepository,
	) {}

	/** Common ICD-10 codes by code prefix or title words (the curated list). */
	searchIcd10(query: string): Icd10Code[] {
		return searchIcd10(query);
	}

	/**
	 * The ICD-10 entry of `code` (normalized: `e119` → `E11.9`), on the caller's transaction. A code outside
	 * `icd10_codes`, or inactive, is refused (UNKNOWN_ICD10_CODE).
	 */
	async requireIcd10(tx: ClinicalTx, code: string): Promise<{ code: string; description: string }> {
		const normalized = normalizeIcd10Code(code);
		const row = await this.reference.findIcd10(tx, normalized);
		if (!row?.isActive) {
			throw new UnknownIcd10CodeError(normalized);
		}
		return { code: row.code, description: row.description };
	}

	/**
	 * The barangay given as a PSGC code, or as a name within `cityMunicipalityCode` (the clinic's city), on the
	 * caller's transaction. Refused when it isn't on the list or the name is ambiguous.
	 */
	async resolveBarangay(tx: ClinicalTx, value: string, cityMunicipalityCode: string | null): Promise<Barangay> {
		const byCode = await this.reference.findBarangay(tx, value.trim());
		if (byCode) {
			return toBarangay(byCode);
		}
		const byName = cityMunicipalityCode
			? await this.reference.findBarangaysByName(tx, cityMunicipalityCode, value)
			: [];
		if (byName.length !== 1) {
			throw new UnknownBarangayError(value);
		}
		return toBarangay(byName[0]);
	}

	/** The barangays of a city or municipality, by name. */
	listBarangays(userId: string, cityMunicipalityCode: string): Promise<Barangay[]> {
		return this.db.asUser(userId, async (tx) =>
			(await this.reference.listBarangays(tx, cityMunicipalityCode)).map(toBarangay),
		);
	}

	/** Cities and municipalities by name (or PSGC code), at most 20. */
	searchCityMunicipalities(userId: string, query: string): Promise<CityMunicipality[]> {
		return this.db.asUser(userId, async (tx) =>
			(await this.reference.searchCityMunicipalities(tx, query, 20)).map(toCityMunicipality),
		);
	}

	/**
	 * A PSGC address on the caller's transaction: the city or municipality must be on the list, and the barangay (when
	 * given) one of its barangays. Both may be null (no address yet); a barangay needs its city.
	 */
	async requireAddress(
		tx: ClinicalTx,
		cityMunicipalityCode: string | null,
		barangayCode: string | null,
	): Promise<{ cityMunicipality: CityMunicipality | null; barangay: Barangay | null }> {
		const city = cityMunicipalityCode ? await this.reference.findCityMunicipality(tx, cityMunicipalityCode) : null;
		if (cityMunicipalityCode && !city) {
			throw new UnknownCityMunicipalityError(cityMunicipalityCode);
		}
		const barangay = barangayCode ? await this.reference.findBarangay(tx, barangayCode) : null;
		if (barangayCode && (!barangay || barangay.cityMunicipalityCode !== city?.code)) {
			throw new UnknownBarangayError(barangayCode);
		}
		return { cityMunicipality: city && toCityMunicipality(city), barangay: barangay && toBarangay(barangay) };
	}
}

function toBarangay(row: BarangayRow): Barangay {
	return { code: row.code, name: row.name, cityMunicipalityCode: row.cityMunicipalityCode };
}

function toCityMunicipality(row: CityMunicipalityRow): CityMunicipality {
	return {
		code: row.code,
		name: row.name,
		provinceName: row.province?.name ?? null,
		isCity: row.isCity,
		zipCode: row.zipCode,
	};
}
