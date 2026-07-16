export class SessionWriteConflictError extends Error {
  constructor() {
    super("The intake session changed while this request was being processed.");
    this.name = "SessionWriteConflictError";
  }
}

export async function applySessionRevisionWrite(
  currentRevision: number,
  write: () => Promise<{ count: number }>,
): Promise<number> {
  const result = await write();

  if (result.count !== 1) {
    throw new SessionWriteConflictError();
  }

  return currentRevision + 1;
}
