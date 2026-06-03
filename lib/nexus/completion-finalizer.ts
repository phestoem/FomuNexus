export type SessionCompletionFinalizerParams<Response, CapturedData> = {
  capturedData: CapturedData;
  markCompleted: (capturedData: CapturedData) => Promise<void>;
  restoreActive: (capturedData: CapturedData) => Promise<void>;
  buildResponse: () => Promise<Response>;
  onCompletionError?: (error: unknown) => void;
  onRollbackError?: (error: unknown) => void;
};

export async function finalizeSessionCompletion<Response, CapturedData>({
  capturedData,
  markCompleted,
  restoreActive,
  buildResponse,
  onCompletionError,
  onRollbackError,
}: SessionCompletionFinalizerParams<Response, CapturedData>): Promise<Response> {
  await markCompleted(capturedData);

  try {
    return await buildResponse();
  } catch (completionError) {
    onCompletionError?.(completionError);

    try {
      await restoreActive(capturedData);
    } catch (rollbackError) {
      onRollbackError?.(rollbackError);
    }

    throw completionError;
  }
}
