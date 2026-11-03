/**
 * Demo: sends a synthetic ORU^R01 (HbA1c) over MLLP to a running connector and prints the ACK.
 *
 *   npm run send-mllp -w @loopwise/connector -- --port 2575 [--host 127.0.0.1] [--count 3] [--file message.hl7]
 *
 * Synthetic data only: the patient is the seed's synthetic Maria Santos, so a seeded hub matches her. `--file` sends your own (synthetic) message instead; LF or CRLF
 * line endings are turned into HL7's CR.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { formatTimestamp, normalizeSegments, parseAck } from '../src/hl7.ts';
import { mllpSend } from '../src/mllp.ts';

const { values } = parseArgs({
	options: {
		host: { type: 'string', default: '127.0.0.1' },
		port: { type: 'string', default: process.env.MLLP_PORT ?? '2575' },
		count: { type: 'string', default: '1' },
		file: { type: 'string' },
		value: { type: 'string', default: '8.2' },
	},
});

function syntheticOru(controlId: string, hba1c: string): string {
	const now = formatTimestamp(new Date());
	return [
		`MSH|^~\\&|BDL-LIS|BOHOL-DIAGNOSTICS|LOOPWISE|TAGBILARAN-HC|${now}||ORU^R01^ORU_R01|${controlId}|P|2.5.1`,
		// Maria Santos, the seeded synthetic patient (apps/api/prisma/seed-clinical.ts), so the hub can match her.
		'PID|1||THC-0001^^^THC^MR~SYN-0000-0001^^^PhilHealth^NH||Santos^Maria||19810412|F',
		`OBR|1|ORD-${controlId}|LAB-${controlId}|4548-4^Hemoglobin A1c/Hemoglobin.total in Blood^LN|||${now}`,
		`OBX|1|NM|4548-4^Hemoglobin A1c/Hemoglobin.total in Blood^LN||${hba1c}|%|4.0-5.6|${Number(hba1c) > 5.6 ? 'H' : 'N'}|||F|||${now}`,
	].join('\r');
}

const count = Number(values.count);
for (let index = 0; index < count; index += 1) {
	const controlId = `DEMO${Date.now()}${index}`.slice(0, 20);
	const message = values.file
		? normalizeSegments(readFileSync(values.file, 'utf8'))
		: syntheticOru(controlId, values.value!);
	try {
		const ack = await mllpSend(message, { host: values.host!, port: Number(values.port), timeoutMs: 10_000 });
		const parsed = parseAck(ack);
		console.log(
			`${parsed?.controlId || controlId}: ${parsed?.code ?? 'no MSA'}${parsed?.text ? ` (${parsed.text})` : ''}`,
		);
	} catch (error) {
		console.error(`send failed: ${(error as Error).message}`);
		process.exitCode = 1;
		break;
	}
}
