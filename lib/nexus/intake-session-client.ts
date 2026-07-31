/**
 * Soft navigation between `/form/[sessionId]` routes reuses the same React
 * tree. In-flight next-step responses from a previous session must not apply
 * after the bound sessionId has changed.
 */
export function shouldApplyIntakeResponse(
  responseGeneration: number,
  activeGeneration: number,
): boolean {
  return responseGeneration === activeGeneration;
}
