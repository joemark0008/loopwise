import { copyFile, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { createWorker, OEM, type Worker } from 'tesseract.js';

import { loadDotenv, ocrEnvSchema } from '../config/env.js';

/** English and Filipino: what Philippine clinic paperwork is written in. */
export const OCR_LANGUAGES = ['eng', 'fil'] as const;

/** An idle worker holds ~100 MB of WASM heap and keeps the process alive, so it goes after this long unused. */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export class OcrTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`OCR took longer than ${Math.round(timeoutMs / 1000)} s and was stopped`);
		this.name = 'OcrTimeoutError';
	}
}

let workerPromise: Promise<Worker> | null = null;
let idleTimer: NodeJS.Timeout | null = null;

/**
 * Reads the text in an image (PNG, JPEG, …) with Tesseract, in process. One worker is shared and created on first
 * use; Tesseract queues the calls, so concurrent reads wait their turn instead of each spawning a worker.
 * @throws OcrTimeoutError when recognition outlasts `timeoutMs`; the worker is then discarded, since the job it is
 * running can't be cancelled.
 */
export const recognizeImage = async (image: Buffer, timeoutMs: number): Promise<string> => {
	const worker = await getWorker();
	clearIdleTimer();

	let timer: NodeJS.Timeout | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new OcrTimeoutError(timeoutMs)), timeoutMs);
	});

	try {
		const { data } = await Promise.race([worker.recognize(image), timeout]);
		return data.text;
	} catch (error) {
		if (error instanceof OcrTimeoutError) {
			await terminateOcr();
		}
		throw error;
	} finally {
		clearTimeout(timer);
		scheduleIdleShutdown();
	}
};

/** Stops the shared worker, if any: on shutdown, after a timeout, and in tests. */
export const terminateOcr = async (): Promise<void> => {
	clearIdleTimer();
	const pending = workerPromise;
	workerPromise = null;
	if (!pending) {
		return;
	}
	try {
		await (await pending).terminate();
	} catch {
		// A worker that failed to start has nothing to stop.
	}
};

const getWorker = (): Promise<Worker> => {
	workerPromise ??= createOcrWorker().catch((error: unknown) => {
		workerPromise = null;
		throw new Error(`OCR is unavailable: ${error instanceof Error ? error.message : String(error)}`);
	});
	return workerPromise;
};

const createOcrWorker = async (): Promise<Worker> => {
	return createWorker([...OCR_LANGUAGES], OEM.LSTM_ONLY, {
		langPath: await languageDataPath(),
		gzip: true,
		// Never write the unpacked language data next to the process (tesseract.js caches into the cwd by default).
		cacheMethod: 'none',
	});
};

/**
 * The directory tesseract.js reads `<lang>.traineddata.gz` from. It takes one directory for every language, while
 * the bundled data ships one package per language, so those copies are staged together under the temp directory
 * once per process. Nothing is fetched from the network.
 */
const languageDataPath = async (): Promise<string> => {
	loadDotenv();
	const configured = ocrEnvSchema.parse(process.env).OCR_LANG_PATH;
	if (configured) {
		return path.resolve(configured);
	}

	const require = createRequire(import.meta.url);
	const staged = path.join(os.tmpdir(), 'loopwise-ocr-lang');
	await mkdir(staged, { recursive: true });

	await Promise.all(
		OCR_LANGUAGES.map(async (lang) => {
			const packageDir = path.dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
			const source = path.join(packageDir, '4.0.0_best_int', `${lang}.traineddata.gz`);
			const target = path.join(staged, `${lang}.traineddata.gz`);
			const [sourceStat, targetStat] = await Promise.all([stat(source), stat(target).catch(() => null)]);
			if (targetStat?.size !== sourceStat.size) {
				await copyFile(source, target);
			}
		}),
	);

	return staged;
};

const clearIdleTimer = (): void => {
	if (idleTimer) {
		clearTimeout(idleTimer);
		idleTimer = null;
	}
};

const scheduleIdleShutdown = (): void => {
	clearIdleTimer();
	idleTimer = setTimeout(() => void terminateOcr(), IDLE_TIMEOUT_MS);
	idleTimer.unref();
};
