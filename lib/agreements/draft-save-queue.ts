export type DraftSaveResult = { ok: true } | { error: string };

export type SerialSaveQueue<T> = {
  enqueue: (value: T) => Promise<DraftSaveResult>;
  waitForIdle: () => Promise<void>;
  saveNow: (value: T) => Promise<DraftSaveResult>;
};

export function createSerialSaveQueue<T>(
  save: (value: T) => Promise<DraftSaveResult>,
): SerialSaveQueue<T> {
  let pending: T | undefined;
  let inFlight: Promise<DraftSaveResult> | null = null;
  let lastResult: DraftSaveResult = { ok: true };

  async function drain(): Promise<DraftSaveResult> {
    try {
      while (pending !== undefined) {
        const snapshot = pending;
        pending = undefined;
        try {
          lastResult = await save(snapshot);
        } catch (caught) {
          lastResult = {
            error: caught instanceof Error ? caught.message : "Save failed",
          };
        }
      }
      return lastResult;
    } finally {
      inFlight = null;
      if (pending !== undefined) {
        inFlight = drain();
      }
    }
  }

  function enqueue(value: T): Promise<DraftSaveResult> {
    pending = value;
    inFlight ??= drain();
    return inFlight.then(async () => {
      await waitForIdle();
      return lastResult;
    });
  }

  async function waitForIdle(): Promise<void> {
    while (inFlight) {
      await inFlight;
    }
  }

  async function saveNow(value: T): Promise<DraftSaveResult> {
    await waitForIdle();
    return enqueue(value);
  }

  return { enqueue, waitForIdle, saveNow };
}
