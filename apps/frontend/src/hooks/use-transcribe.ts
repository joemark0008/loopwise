import { useState, useRef, useCallback, useEffect } from 'react';

import { transcribeAudio } from '@/lib/transcribe';

type TranscribeState = 'idle' | 'recording' | 'transcribing';

/**
 * Records from the microphone and turns the recording into text. `transcribe` replaces the default endpoint (the AI
 * scribe sends its consent-checked one); `onError` hears a failed transcription instead of the console.
 */
export function useTranscribe({
	onTranscribed,
	transcribe = transcribeAudio,
	onError,
}: {
	onTranscribed: (text: string) => void;
	transcribe?: (input: { audio: string }) => Promise<{ text: string }>;
	onError?: (error: Error) => void;
}) {
	const [state, setState] = useState<TranscribeState>('idle');
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const onTranscribedRef = useRef(onTranscribed);
	const transcribeRef = useRef(transcribe);
	const onErrorRef = useRef(onError);
	useEffect(() => {
		onTranscribedRef.current = onTranscribed;
		transcribeRef.current = transcribe;
		onErrorRef.current = onError;
	});

	const stop = useCallback(() => {
		if (mediaRecorderRef.current?.state === 'recording') {
			mediaRecorderRef.current.stop();
		}
	}, []);

	useEffect(() => {
		if (state !== 'recording') {
			return;
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				stop();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [state, stop]);

	const start = useCallback(async () => {
		if (state !== 'idle') {
			return;
		}

		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (err) {
			if (!onErrorRef.current) {
				throw err;
			}
			onErrorRef.current(new Error('The microphone is not available. Allow it in the browser, or type instead.'));
			return;
		}

		const audioCtx = new AudioContext();
		const source = audioCtx.createMediaStreamSource(stream);
		const analyser = audioCtx.createAnalyser();
		analyser.fftSize = 512;
		analyser.smoothingTimeConstant = 0.4;
		source.connect(analyser);
		audioCtxRef.current = audioCtx;
		analyserRef.current = analyser;

		const mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
		mediaRecorderRef.current = mediaRecorder;
		chunksRef.current = [];

		mediaRecorder.ondataavailable = (e) => {
			if (e.data.size > 0) {
				chunksRef.current.push(e.data);
			}
		};

		mediaRecorder.onstop = async () => {
			stream.getTracks().forEach((t) => t.stop());
			audioCtxRef.current?.close();
			audioCtxRef.current = null;
			analyserRef.current = null;

			const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
			if (blob.size === 0) {
				setState('idle');
				return;
			}

			setState('transcribing');

			try {
				const base64 = await blobToBase64(blob);
				const { text } = await transcribeRef.current({ audio: base64 });
				if (text?.trim()) {
					onTranscribedRef.current(text.trim());
				}
			} catch (err) {
				if (onErrorRef.current) {
					onErrorRef.current(err instanceof Error ? err : new Error('Transcription failed'));
				} else {
					console.error('Transcription error:', err);
				}
			} finally {
				setState('idle');
			}
		};

		mediaRecorder.start();
		setState('recording');
	}, [state]);

	const toggle = useCallback(() => {
		if (state === 'recording') {
			stop();
		} else if (state === 'idle') {
			start();
		}
	}, [state, start, stop]);

	return {
		state,
		toggle,
		isRecording: state === 'recording',
		isTranscribing: state === 'transcribing',
		analyserRef,
	};
}

function getSupportedMimeType(): string {
	const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
	return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const dataUrl = reader.result as string;
			resolve(dataUrl.split(',')[1]);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}
