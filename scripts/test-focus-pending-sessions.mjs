// Regression test for utils/focusPendingSessions.ts.
//
// Runs on plain Node with no test framework, using Node's built-in TypeScript
// type-stripping. Requires Node >= 22.6 (or >= 23 without a flag).
//
//   npm run test:unit
//
// Two behaviours matter here:
//  1. A finished focus session used to be lost whenever the upload failed, because the
//     timer state was already cleared locally.
//  2. The queue lives in localStorage, which every account on the device shares. Entries
//     must therefore carry their owner, or whoever logs in next uploads someone else's
//     minutes into their own statistics.

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const NODE_MINOR = Number(process.versions.node.split('.')[1]);
if (NODE_MAJOR < 22 || (NODE_MAJOR === 22 && NODE_MINOR < 6)) {
  console.error(`test:unit needs Node >= 22.6 for TypeScript type-stripping (running ${process.versions.node}).`);
  process.exit(1);
}

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { queueFocusSession, pendingFocusSessionCount, flushPendingFocusSessions } = await import(
  '../utils/focusPendingSessions.ts'
);

let pass = 0;
let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name} ${extra}`);
  }
};

const KEY = 'gifts_pending_focus_sessions_v1';
const ALICE = 'user-alice';
const BOB = 'user-bob';
const reset = () => store.clear();
const stored = () => JSON.parse(store.get(KEY) || '[]');

// queueFocusSession logs a warning for the rejected cases below; keep the output readable.
const quiet = (fn) => {
  const original = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = original;
  }
};

console.log('\n[1] empty queue');
reset();
check('count is 0', pendingFocusSessionCount() === 0);
check(
  'flush returns 0 and calls nothing',
  (await flushPendingFocusSessions(ALICE, async () => {
    throw new Error('should not be called');
  })) === 0
);

console.log('\n[2] queue then flush successfully');
reset();
queueFocusSession(ALICE, 25);
queueFocusSession(ALICE, 45);
check('count is 2', pendingFocusSessionCount() === 2, `got ${pendingFocusSessionCount()}`);
const sent = [];
const n = await flushPendingFocusSessions(ALICE, async (m) => {
  sent.push(m);
});
check('flushed 2', n === 2, `got ${n}`);
check('oldest first', JSON.stringify(sent) === '[25,45]', `got ${JSON.stringify(sent)}`);
check('queue emptied', pendingFocusSessionCount() === 0);

console.log('\n[3] partial failure keeps the rest queued');
reset();
queueFocusSession(ALICE, 10);
queueFocusSession(ALICE, 20);
queueFocusSession(ALICE, 30);
let calls = 0;
const n3 = await flushPendingFocusSessions(ALICE, async () => {
  calls += 1;
  if (calls === 2) throw new Error('network down');
});
check('flushed only the first', n3 === 1, `got ${n3}`);
check('stopped at failure (2 calls)', calls === 2, `got ${calls}`);
check('2 remain queued', pendingFocusSessionCount() === 2, `got ${pendingFocusSessionCount()}`);
const rest = [];
await flushPendingFocusSessions(ALICE, async (m) => rest.push(m));
check('remaining replayed in order', JSON.stringify(rest) === '[20,30]', `got ${JSON.stringify(rest)}`);

console.log('\n[4] invalid input rejected');
reset();
queueFocusSession(ALICE, 0);
queueFocusSession(ALICE, -5);
queueFocusSession(ALICE, NaN);
check('nothing queued for invalid minutes', pendingFocusSessionCount() === 0, `got ${pendingFocusSessionCount()}`);
queueFocusSession(ALICE, 9999);
check('minutes clamped to 240', stored()[0].focusMinutes === 240, `got ${stored()[0]?.focusMinutes}`);

console.log('\n[5] queue capped at 20');
reset();
for (let i = 0; i < 30; i += 1) queueFocusSession(ALICE, 5);
check('capped at 20', pendingFocusSessionCount() === 20, `got ${pendingFocusSessionCount()}`);
check(
  'all 20 ids unique',
  new Set(stored().map((e) => e.id)).size === 20,
  `got ${new Set(stored().map((e) => e.id)).size} unique`
);

console.log('\n[5b] duplicate ids cannot make one success drop other sessions');
reset();
// The pathological case an earlier id scheme (timestamp + queue length) could produce.
store.set(
  KEY,
  JSON.stringify([
    { id: 'dup', userId: ALICE, focusMinutes: 10, at: 1 },
    { id: 'dup', userId: ALICE, focusMinutes: 20, at: 2 },
    { id: 'dup', userId: ALICE, focusMinutes: 30, at: 3 },
  ])
);
const dupSent = [];
const dupFlushed = await flushPendingFocusSessions(ALICE, async (m) => {
  dupSent.push(m);
});
check('all three uploaded despite identical ids', dupFlushed === 3, `got ${dupFlushed}`);
check('minutes all reported', JSON.stringify(dupSent) === '[10,20,30]', `got ${JSON.stringify(dupSent)}`);
check('queue emptied', pendingFocusSessionCount() === 0);

console.log('\n[6] corrupt storage does not throw');
reset();
store.set(KEY, '{not json');
check('corrupt json -> count 0', pendingFocusSessionCount() === 0);
store.set(KEY, '[{"focusMinutes":"abc"},{"id":"x","userId":"u","focusMinutes":15}]');
check('drops bad entries, keeps good', pendingFocusSessionCount() === 1, `got ${pendingFocusSessionCount()}`);
store.set(KEY, '{"not":"an array"}');
check('non-array -> count 0', pendingFocusSessionCount() === 0);

console.log('\n[7] localStorage quota failure is swallowed');
reset();
const originalSetItem = globalThis.localStorage.setItem;
globalThis.localStorage.setItem = () => {
  throw new Error('QuotaExceededError');
};
let threw = false;
try {
  queueFocusSession(ALICE, 25);
} catch {
  threw = true;
}
check('queueFocusSession does not throw on quota error', !threw);
globalThis.localStorage.setItem = originalSetItem;

console.log('\n[8] entries are bound to their owner');
reset();
queueFocusSession(ALICE, 30);
check('recorded owner', stored()[0]?.userId === ALICE, `got ${stored()[0]?.userId}`);
check('queueing without a user id is refused', quiet(() => queueFocusSession(null, 15)) === undefined && pendingFocusSessionCount() === 1);
check('blank user id is refused', quiet(() => queueFocusSession('   ', 15)) === undefined && pendingFocusSessionCount() === 1);

console.log('\n[9] flushing one account never touches another');
reset();
queueFocusSession(ALICE, 11);
queueFocusSession(BOB, 22);
queueFocusSession(ALICE, 33);
const aliceSent = [];
const aliceCount = await flushPendingFocusSessions(ALICE, async (m) => {
  aliceSent.push(m);
});
check('alice uploaded only her own', JSON.stringify(aliceSent) === '[11,33]', `got ${JSON.stringify(aliceSent)}`);
check('flushed 2', aliceCount === 2, `got ${aliceCount}`);
check('bob entry survives', stored().length === 1 && stored()[0].userId === BOB, JSON.stringify(stored()));
const bobSent = [];
await flushPendingFocusSessions(BOB, async (m) => bobSent.push(m));
check('bob uploaded his own later', JSON.stringify(bobSent) === '[22]', `got ${JSON.stringify(bobSent)}`);

console.log('\n[10] flushing without a user id does nothing');
reset();
queueFocusSession(ALICE, 40);
const idle = [];
const idleCount = await flushPendingFocusSessions('', async (m) => idle.push(m));
check('nothing uploaded', idleCount === 0 && idle.length === 0);
check('entry still queued', pendingFocusSessionCount() === 1);

console.log('\n[11] legacy entries without an owner are never uploaded but preserved');
reset();
store.set(
  KEY,
  JSON.stringify([
    { id: 'old-1', focusMinutes: 50, at: 1 },
    { id: 'old-2', focusMinutes: 60, at: 2 },
  ])
);
const legacySent = [];
const legacyCount = await flushPendingFocusSessions(ALICE, async (m) => legacySent.push(m));
check('not uploaded to whoever logs in next', legacyCount === 0 && legacySent.length === 0);
check('still in storage for inspection', pendingFocusSessionCount() === 2, `got ${pendingFocusSessionCount()}`);

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES PRESENT'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
