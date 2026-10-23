const STORAGE_KEY = 'gifts_pending_focus_sessions_v1';
const MAX_QUEUED = 20;
const MAX_MINUTES_PER_SESSION = 240;

export interface PendingFocusSession {
  id: string;
  focusMinutes: number;
  at: number;
}

const clampMinutes = (value: unknown): number => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(MAX_MINUTES_PER_SESSION, n);
};

const readQueue = (): PendingFocusSession[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index) => ({
        id: typeof item?.id === 'string' && item.id ? item.id : `legacy-${index}`,
        focusMinutes: clampMinutes(item?.focusMinutes),
        at: Number.isFinite(Number(item?.at)) ? Number(item.at) : Date.now(),
      }))
      .filter((item) => item.focusMinutes > 0)
      .slice(-MAX_QUEUED);
  } catch {
    return [];
  }
};

const writeQueue = (queue: PendingFocusSession[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED)));
  } catch (error) {
    // Private-mode Safari and quota exhaustion both throw here. Losing the retry queue
    // is far less bad than an unhandled rejection in the completion path.
    console.error('Failed to persist pending focus sessions:', error);
  }
};

let idSeq = 0;
const nextId = (): string => {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') return webCrypto.randomUUID();
  idSeq += 1;
  return `${Date.now().toString(36)}-${idSeq.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
};

/**
 * Remembers a finished session whose upload failed, so the minutes are not lost.
 * Reporting is at-least-once: a request that reached the server but whose response was
 * lost will be counted twice, which is preferable to dropping the session entirely.
 */
export const queueFocusSession = (focusMinutes: number): void => {
  const minutes = clampMinutes(focusMinutes);
  if (minutes < 1) return;

  const queue = readQueue();
  queue.push({ id: nextId(), focusMinutes: minutes, at: Date.now() });
  writeQueue(queue);
};

export const pendingFocusSessionCount = (): number => readQueue().length;

/**
 * Uploads queued sessions oldest-first, persisting the remainder after each success.
 * Stops at the first failure so a flaky network does not turn into a retry storm.
 * Removal is positional rather than by id, so duplicate or regenerated ids can never
 * cause a successful upload to drop other queued sessions.
 * Returns how many sessions were uploaded.
 */
export const flushPendingFocusSessions = async (
  complete: (focusMinutes: number) => Promise<void>
): Promise<number> => {
  const queue = readQueue();
  let flushed = 0;

  while (flushed < queue.length) {
    try {
      await complete(queue[flushed].focusMinutes);
    } catch {
      break;
    }
    flushed += 1;
    writeQueue(queue.slice(flushed));
  }

  return flushed;
};
