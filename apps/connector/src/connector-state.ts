/**
 * State shared by the workers and the health endpoint. A 401/403 from the hub halts every worker that talks to it: the
 * facility key is one for both directions, and hammering the hub with a bad key helps nobody. The MLLP listener keeps
 * accepting and queueing, so nothing is lost while someone fixes the key and restarts the connector.
 */
export class ConnectorState {
	haltReason: string | null = null;
	lastHubSuccessAt: number | null = null;
	lastHubError: string | null = null;
	lastOutboxPollAt: number | null = null;

	halt(reason: string): boolean {
		if (this.haltReason) {
			return false;
		}
		this.haltReason = reason;
		return true;
	}

	get halted(): boolean {
		return this.haltReason !== null;
	}
}
