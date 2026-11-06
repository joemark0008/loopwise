/**
 * The pharmacy's rules (DESIGN.md §5.5): generic equivalence and substitution (RA 6675, the Generics Act) and the S2
 * details a dangerous drug is dispensed against (RA 9165). Pure, unit-tested in `dispense-rules.spec.ts`.
 */

const normalize = (value: string | null | undefined) =>
	(value ?? '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(/\s*(mg|mcg|g|ml|iu|%)\b/g, '$1')
		.trim();

/** The same generic: an item can fill a prescribed medicine only when its generic name is the one written. */
export function isSameGeneric(prescribed: string, itemGeneric: string | null): boolean {
	return itemGeneric !== null && normalize(prescribed) === normalize(itemGeneric);
}

/** The strength matches, when both are written ("500 mg" = "500mg"). */
export function isSameStrength(prescribed: string | null, itemStrength: string | null): boolean {
	return !prescribed || !itemStrength || normalize(prescribed) === normalize(itemStrength);
}

/** A prescribed line as the substitution rule sees it. */
export interface PrescribedLine {
	inventoryItemId: string | null;
	brandName: string | null;
}

/** A stock item as the substitution rule sees it. */
export interface StockChoice {
	id: string;
	brandName: string | null;
}

/**
 * Whether giving `item` is the prescribed product: the item linked on the line, else the brand written (when one was);
 * a generic-only line is filled by any equivalent generic without it being a substitution.
 */
export function isPrescribedProduct(line: PrescribedLine, item: StockChoice): boolean {
	if (line.inventoryItemId) {
		return line.inventoryItemId === item.id;
	}
	return !line.brandName || normalize(line.brandName) === normalize(item.brandName);
}

/** The S2 facts of a prescription a dangerous drug is dispensed against. */
export interface S2Facts {
	s2FormSerialNo: string | null;
	prescriberS2LicenseNo: string | null;
	/** The dangerous-drug lines, with their quantity in words. */
	dangerousLines: readonly { genericName: string; quantityInWords: string | null }[];
}

/**
 * What the prescription still needs before a dangerous drug on it is dispensed (RA 9165: the DOH form's serial
 * number, the prescriber's PDEA S2 license, each quantity in words); null when complete or when nothing on it is a
 * dangerous drug.
 */
export function s2Missing(facts: S2Facts): string | null {
	if (facts.dangerousLines.length === 0) {
		return null;
	}
	const missing: string[] = [];
	if (!facts.s2FormSerialNo?.trim()) {
		missing.push('the S2 form serial number');
	}
	if (!facts.prescriberS2LicenseNo?.trim()) {
		missing.push("the prescriber's S2 license number");
	}
	const noWords = facts.dangerousLines.filter((line) => !line.quantityInWords?.trim());
	if (noWords.length > 0) {
		missing.push(`the quantity in words for ${noWords.map((line) => line.genericName).join(', ')}`);
	}
	return missing.length > 0 ? missing.join(', ') : null;
}
