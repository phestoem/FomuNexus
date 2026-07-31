/**
 * When the model proposes a dynamic follow-up that the backend rejects (cap,
 * duplicate, or invalid key), the model `questionPrompt` is worded for that
 * rejected follow-up. Asking it while `fieldKey` remains the original missing
 * field misbinds answers and can loop until the model stops proposing injections.
 */
export function resolveQuestionPromptAfterInjectionAttempt(params: {
  injectionRequested: boolean;
  injectionAccepted: boolean;
  modelQuestionPrompt: string;
  blueprintFieldFallback: string;
}): string {
  if (params.injectionRequested && !params.injectionAccepted) {
    return params.blueprintFieldFallback;
  }

  return params.modelQuestionPrompt;
}
