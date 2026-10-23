const STORAGE_KEY = 'gifts_pending_focus_sessions_v1';
const MAX_QUEUED = 20;
const MAX_MINUTES_PER_SESSION = 240;

export interface PendingFocusSession {
  id: string;
  /** Owner of the session. Empty only for entries written before this field existed. */
  userId: string;
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
        userId: typeof item?.userId === 'string' ? item.userId : '',
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
 *
 * The owner is recorded because the queue lives in localStorage, which is shared by every
 * account that signs in on this device. Without it, whoever logs in next would upload the
 * previous user's minutes into their own statistics.
 */
export const queueFocusSession = (userId: string | null | undefined, focusMinutes: number): void => {
  const minutes = clampMinutes(focusMinutes);
  const owner = String(userId || '').trim();
  if (minutes < 1) return;
  if (!owner) {
    // Nothing to attribute it to; uploading later would credit the wrong account.
    console.warn('Skipped queueing a focus session without a user id');
    return;
  }

  const queue = readQueue();
  queue.push({ id: nextId(), userId: owner, focusMinutes: minutes, at: Date.now() });
  writeQueue(queue);
};

export const pendingFocusSessionCount = (): number => readQueue().length;

/**
 * Uploads this user's queued sessions, oldest first, removing each one only after it
 * succeeds. Entries belonging to other accounts are left untouched in the queue.
 * Stops at the first failure so a flaky network does not turn into a retry storm.
 * Returns how many sessions were uploaded.
 *
 * Entries from before the owner was recorded cannot be attributed to anybody. They are
 * never uploaded and simply age out as newer sessions push them past MAX_QUEUED.
 */
export const flushPendingFocusSessions = async (
  userId: string | null | undefined,
  complete: (focusMinutes: number) => Promise<void>
): Promise<number> => {
  const owner = String(userId || '').trim();
  if (!owner) return 0;

  let queue = readQueue();
  let flushed = 0;

  for (;;) {
    const index = queue.findIndex((item) => item.userId === owner);
    if (index === -1) break;

    try {
      await complete(queue[index].focusMinutes);
    } catch {
      break;
    }

    flushed += 1;
    queue = [...queue.slice(0, index), ...queue.slice(index + 1)];
    writeQueue(queue);
  }

  return flushed;
};
