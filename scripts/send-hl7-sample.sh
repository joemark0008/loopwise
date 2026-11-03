#!/usr/bin/env bash
# Posts a synthetic HL7 ORU^R01 (Maria Santos's HbA1c 7.2%, DESIGN.md §4.1 step 5) to the hub's ingest, as the edge
# connector would, and prints the ACK. Synthetic data only.
#
#   scripts/send-hl7-sample.sh [placer-order-id]
#
# Env: LOOPWISE_API_URL (default http://localhost:5006), LOOPWISE_FACILITY_KEY (default: the seed's DEV-ONLY
# bohol-diagnostics key), HL7_VALUE / HL7_FLAG (default 7.2 / H; try 12.4 / HH for a critical value),
# HL7_CONTROL_ID (default: unique per run; reuse one to see the idempotent resend).
set -euo pipefail

API_URL="${LOOPWISE_API_URL:-http://localhost:5006}"
KEY="${LOOPWISE_FACILITY_KEY:-lw_dev_bohol_diagnostics_synthetic_key_0001}"
PLACER="${1:-}"
VALUE="${HL7_VALUE:-7.2}"
FLAG="${HL7_FLAG:-H}"
CONTROL_ID="${HL7_CONTROL_ID:-BDL-$(date +%Y%m%d%H%M%S)-$$}"
NOW="$(TZ=Asia/Manila date +%Y%m%d%H%M%S)+0800"

MESSAGE="MSH|^~\\&|BDL-LIS|BOHOL-DIAGNOSTICS|LOOPWISE|TAGBILARAN-HC|${NOW}||ORU^R01^ORU_R01|${CONTROL_ID}|P|2.5.1"
MESSAGE+=$'\r'"PID|1||THC-0001^^^THC^MR~SYN-0000-0001^^^PhilHealth^NH||Santos^Maria||19810412|F"
MESSAGE+=$'\r'"ORC|RE|${PLACER}|BDL-ACC-${CONTROL_ID}"
MESSAGE+=$'\r'"OBR|1|${PLACER}|BDL-ACC-${CONTROL_ID}|4548-4^Hemoglobin A1c^LN|||${NOW}|||||||||||||||${NOW}||CH|F"
MESSAGE+=$'\r'"OBX|1|NM|4548-4^Hemoglobin A1c^LN||${VALUE}|%^%^UCUM|4.0-5.6|${FLAG}|||F|||${NOW}"

echo "POST ${API_URL}/api/hl7/messages  (MSH-10 ${CONTROL_ID})" >&2
printf '%s' "$MESSAGE" |
	curl --silent --show-error --fail-with-body \
		-H "Authorization: Bearer ${KEY}" \
		-H 'Content-Type: text/plain' \
		--data-binary @- \
		"${API_URL}/api/hl7/messages" |
	tr '\r' '\n'
echo
