import { Injectable } from '@nestjs/common';

import type { Barangay, Icd10Code, Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

export type CityMunicipalityRow = Prisma.CityMunicipalityGetPayload<{
	include: { province: { select: { name: true } } };
}>;

/** Reference data (ICD-10, PSGC): readable by everyone signed in, on the caller's transaction. */
@Injectable()
export class ReferenceRepository {
	findIcd10(tx: ClinicalTx, code: string): Promise<Icd10Code | null> {
		return tx.icd10Code.findUnique({ where: { code } });
	}

	findBarangay(tx: ClinicalTx, code: string): Promise<Barangay | null> {
		return tx.barangay.findUnique({ where: { code } });
	}

	/** Barangays of a city or municipality named `name` (case-insensitive). */
	findBarangaysByName(tx: ClinicalTx, cityMunicipalityCode: string, name: string): Promise<Barangay[]> {
		return tx.barangay.findMany({
			where: { cityMunicipalityCode, name: { equals: name.trim(), mode: 'insensitive' } },
		});
	}

	/** Cities and municipalities whose name contains `query` (case-insensitive), or with that PSGC code, by name. */
	searchCityMunicipalities(tx: ClinicalTx, query: string, take: number): Promise<CityMunicipalityRow[]> {
		const text = query.trim();
		return tx.cityMunicipality.findMany({
			where: text ? { OR: [{ code: text }, { name: { contains: text, mode: 'insensitive' } }] } : {},
			include: { province: { select: { name: true } } },
			orderBy: { name: 'asc' },
			take,
		});
	}

	findCityMunicipality(tx: ClinicalTx, code: string): Promise<CityMunicipalityRow | null> {
		return tx.cityMunicipality.findUnique({ where: { code }, include: { province: { select: { name: true } } } });
	}

	listBarangays(tx: ClinicalTx, cityMunicipalityCode: string): Promise<Barangay[]> {
		return tx.barangay.findMany({ where: { cityMunicipalityCode }, orderBy: { name: 'asc' } });
	}
}
