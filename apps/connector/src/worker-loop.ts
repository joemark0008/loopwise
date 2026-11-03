/**
 * Runs `tick` again and again: after each run it sleeps for the delay `tick` returns, unless `wake()` cuts the sleep
 * short. `stop()` resolves once the run in progress (if any) has finished, so shutdown never cuts a send in half.
 */
export class WorkerLoop {
	private readonly tick: () => Promise<number>;
	private running = false;
	private loop: Promise<void> | null = null;
	private timer: NodeJS.Timeout | null = null;
	private wakeSleep: (() => void) | null = null;
	private wakeRequested = false;

	constructor(tick: () => Promise<number>) {
		this.tick = tick;
	}

	start(): void {
		if (this.running) {
			return;
		}
		this.running = true;
		this.loop = this.run();
	}

	wake(): void {
		this.wakeRequested = true;
		this.wakeSleep?.();
	}

	async stop(): Promise<void> {
		this.running = false;
		this.wake();
		await this.loop;
		this.loop = null;
	}

	private async run(): Promise<void> {
		while (this.running) {
			this.wakeRequested = false;
			const delay = await this.tick();
			if (!this.running) {
				break;
			}
			if (this.wakeRequested) {
				continue;
			}
			await new Promise<void>((resolve) => {
				this.wakeSleep = resolve;
				this.timer = setTimeout(resolve, Math.max(0, delay));
			});
			if (this.timer) {
				clearTimeout(this.timer);
			}
			this.timer = null;
			this.wakeSleep = null;
		}
	}
}
