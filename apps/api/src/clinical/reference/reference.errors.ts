import { DomainError } from '../../common/errors/domain-error.js';

/** A diagnosis must carry a code of the ICD-10 list (`icd10_codes`), as PhilHealth claims require. */
export class UnknownIcd10CodeError extends DomainError {
	constructor(code: string) {
		super('BAD_REQUEST', 'UNKNOWN_ICD10_CODE', `${code} is not in the ICD-10 list. Pick a code from the search.`, {
			code,
		});
	}
}

/** A city or municipality must be one of the PSGC list (`city_municipalities`). */
export class UnknownCityMunicipalityError extends DomainError {
	constructor(code: string) {
		super('BAD_REQUEST', 'UNKNOWN_CITY_MUNICIPALITY', `${code} is not a city or municipality on the list.`, {
			code,
		});
	}
}

/** A barangay must be one of the PSGC list (`barangays`). */
export class UnknownBarangayError extends DomainError {
	constructor(value: string) {
		super('BAD_REQUEST', 'UNKNOWN_BARANGAY', `${value} is not a barangay on the list.`, { value });
	}
}
