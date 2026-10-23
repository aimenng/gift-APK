// Regression test for utils/focusPendingSessions.ts.
//
// Runs on plain Node with no test framework, using Node's built-in TypeScript
// type-stripping. Requires Node >= 22.6 (or >= 23 without a flag).
//
//   npm run test:unit
//
// This queue exists because a finished focus session used to be lost whenever the
// upload failed: the timer state was cleared locally first, so the minutes vanished.

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
const reset = () => store.clear();

console.log('\n[1] empty queue');
reset();
check('count is 0', pendingFocusSessionCount() === 0);
check(
  'flush returns 0 and calls nothing',
  (await flushPendingFocusSessions(async () => {
    throw new Error('should not be called');
  })) === 0
);

console.log('\n[2] queue then flush successfully');
reset();
queueFocusSession(25);
queueFocusSession(45);
check('count is 2', pendingFocusSessionCount() === 2, `got ${pendingFocusSessionCount()}`);
const sent = [];
const n = await flushPendingFocusSessions(async (m) => {
  sent.push(m);
});
check('flushed 2', n === 2, `got ${n}`);
check('oldest first', JSON.stringify(sent) === '[25,45]', `got ${JSON.stringify(sent)}`);
check('queue emptied', pendingFocusSessionCount() === 0);

console.log('\n[3] partial failure keeps the rest queued');
reset();
queueFocusSession(10);
queueFocusSession(20);
queueFocusSession(30);
let calls = 0;
const n3 = await flushPendingFocusSessions(async () => {
  calls += 1;
  if (calls === 2) throw new Error('network down');
});
check('flushed only the first', n3 === 1, `got ${n3}`);
check('stopped at failure (2 calls)', calls === 2, `got ${calls}`);
check('2 remain queued', pendingFocusSessionCount() === 2, `got ${pendingFocusSessionCount()}`);
const rest = [];
await flushPendingFocusSessions(async (m) => rest.push(m));
check('remaining replayed in order', JSON.stringify(rest) === '[20,30]', `got ${JSON.stringify(rest)}`);

console.log('\n[4] invalid input rejected');
reset();
queueFocusSession(0);
queueFocusSession(-5);
queueFocusSession(NaN);
check('nothing queued for invalid minutes', pendingFocusSessionCount() === 0, `got ${pendingFocusSessionCount()}`);
queueFocusSession(9999);
const clamped = JSON.parse(store.get(KEY));
check('minutes clamped to 240', clamped[0].focusMinutes === 240, `got ${clamped[0].focusMinutes}`);

console.log('\n[5] queue capped at 20');
reset();
for (let i = 0; i < 30; i += 1) queueFocusSession(5);
check('capped at 20', pendingFocusSessionCount() === 20, `got ${pendingFocusSessionCount()}`);
const kept = JSON.parse(store.get(KEY));
check(
  'all 20 ids unique',
  new Set(kept.map((e) => e.id)).size === 20,
  `got ${new Set(kept.map((e) => e.id)).size} unique`
);
check('all entries carry the queued minutes', kept.every((e) => e.focusMinutes === 5));

console.log('\n[5b] duplicate ids cannot make one success drop other sessions');
reset();
// The pathological case an earlier id scheme (timestamp + queue length) could produce.
store.set(
  KEY,
  JSON.stringify([
    { id: 'dup', focusMinutes: 10, at: 1 },
    { id: 'dup', focusMinutes: 20, at: 2 },
    { id: 'dup', focusMinutes: 30, at: 3 },
  ])
);
const dupSent = [];
const dupFlushed = await flushPendingFocusSessions(async (m) => {
  dupSent.push(m);
});
check('all three uploaded despite identical ids', dupFlushed === 3, `got ${dupFlushed}`);
check('minutes all reported', JSON.stringify(dupSent) === '[10,20,30]', `got ${JSON.stringify(dupSent)}`);
check('queue emptied', pendingFocusSessionCount() === 0);

console.log('\n[6] corrupt storage does not throw');
reset();
store.set(KEY, '{not json');
check('corrupt json -> count 0', pendingFocusSessionCount() === 0);
store.set(KEY, '[{"focusMinutes":"abc"},{"id":"x","focusMinutes":15}]');
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
  queueFocusSession(25);
} catch {
  threw = true;
}
check('queueFocusSession does not throw on quota error', !threw);
globalThis.localStorage.setItem = originalSetItem;

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES PRESENT'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
