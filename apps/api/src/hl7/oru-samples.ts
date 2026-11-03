/**
 * Synthetic ORU^R01 messages for tests and demos (DESIGN.md §4.1 step 5: Maria's HbA1c 7.2%). Invented data only.
 */
export interface SampleOruOptions {
	controlId?: string;
	/** PID-3 repetitions as `value^^^authority^type`. */
	identifiers?: string[];
	familyName?: string;
	givenName?: string;
	birthDate?: string;
	sex?: string;
	/** ORC-2 / OBR-2: the Loopwise order id when the lab answers one of our orders. */
	placerOrderNumber?: string;
	value?: string;
	flag?: string;
}

export function sampleOru(options: SampleOruOptions = {}): string {
	const {
		controlId = 'BDL-0001',
		identifiers = ['THC-0001^^^THC^MR', 'SYN-0000-0001^^^PhilHealth^NH'],
		familyName = 'Santos',
		givenName = 'Maria',
		birthDate = '19810412',
		sex = 'F',
		placerOrderNumber = '',
		value = '7.2',
		flag = 'H',
	} = options;
	return [
		`MSH|^~\\&|BDL-LIS|BOHOL-DIAGNOSTICS|LOOPWISE|TAGBILARAN-HC|20261106093000+0800||ORU^R01^ORU_R01|${controlId}|P|2.5.1`,
		`PID|1||${identifiers.join('~')}||${familyName}^${givenName}||${birthDate}|${sex}`,
		`ORC|RE|${placerOrderNumber}|BDL-ACC-7781`,
		`OBR|1|${placerOrderNumber}|BDL-ACC-7781|4548-4^Hemoglobin A1c^LN|||20261106080000+0800|||||||||||||||20261106092500+0800||CH|F`,
		`OBX|1|NM|4548-4^Hemoglobin A1c^LN||${value}|%^%^UCUM|4.0-5.6|${flag}|||F|||20261106092000+0800`,
	].join('\r');
}

/** A chest X-ray report: TX lines, as a RIS sends them. */
export function sampleRadiologyOru(controlId = 'BRH-RIS-0001'): string {
	return [
		`MSH|^~\\&|BRH-RIS|BOHOL-REGIONAL|LOOPWISE|TAGBILARAN-HC|20261106101500||ORU^R01|${controlId}|P|2.5.1`,
		'PID|1||THC-0001^^^THC^MR~SYN-0000-0001^^^PhilHealth^NH||Santos^Maria||19810412|F',
		'OBR|1||RIS-5512|36643-5^XR Chest 2 Views^LN|||20261106100000',
		'OBX|1|TX|36643-5^XR Chest 2 Views^LN|1|FINDINGS: Clear lungs.||||||F',
		'OBX|2|TX|36643-5^XR Chest 2 Views^LN|1|IMPRESSION: No acute disease \\T\\ normal heart size.||||||F',
	].join('\r');
}
