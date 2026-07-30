/**
 * Decide whether a SpeechRecognition `onend` should auto-submit.
 * User-initiated stops may submit; external stops (form loading, abort,
 * restart) must not, or a concurrent next-step request races the in-flight one.
 */
export function shouldSubmitSpeechOnEnd(options: {
  ignoreNextEnd: boolean;
  transcript: string;
}): boolean {
  if (options.ignoreNextEnd) {
    return false;
  }

  return options.transcript.trim().length > 0;
}
