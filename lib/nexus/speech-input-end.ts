/**
 * Decide whether a SpeechRecognition `onend` should auto-submit.
 * Recognition failures (network, audio-capture, not-allowed, etc.) fire
 * `onerror` and then `onend`; those ends must not submit a partial transcript
 * after the UI has already shown a voice error.
 */
export function shouldSubmitSpeechOnEnd(params: {
  recognitionFailed: boolean;
  transcript: string;
}): boolean {
  if (params.recognitionFailed) {
    return false;
  }

  return params.transcript.trim().length > 0;
}
