// Regression test: the request-code endpoints must not reveal whether an email is
// registered.
//
// Registration only mails unverified addresses and password reset only mails verified
// ones, so any per-address failure that changes the response is an enumeration oracle.
// This boots the real Express app with SMTP deliberately unconfigured — which is the
// failure mode an attacker can trigger cheaply — and asserts both endpoints answer
// identically for a registered-looking and an unknown address.
//
// Runs on plain Node with no test framework. Requires Node >= 22.6 (type stripping is
// irrelevant here, but the repo's test scripts share one runtime baseline).

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const NODE_MINOR = Number(process.versions.node.split('.')[1]);
if (NODE_MAJOR < 22 || (NODE_MAJOR === 22 && NODE_MINOR < 6)) {
  console.error(`needs Node >= 22.6 (running ${process.versions.node}).`);
  process.exit(1);
}

import { promises as fsp, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const envFile = path.join(os.tmpdir(), `xlgift-enum-test-${process.pid}.env`);
// No SMTP_* on purpose: assertMailerReady() must reject before any account lookup.
await fsp.writeFile(
  envFile,
  [
    'SUPABASE_URL=https://example.supabase.co',
    'SUPABASE_SERVICE_ROLE_KEY=test-not-a-real-key',
    'JWT_SECRET=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',
    // Keep the suite fast; the uniform-latency padding is not what is under test.
    'AUTH_UNIFORM_MIN_LATENCY_MS=200',
  ].join('\n')
);
process.env.BACKEND_ENV_FILE = envFile;

const cleanup = () => fsp.rm(envFile, { force: true }).catch(() => {});
process.on('exit', () => {
  rmSync(envFile, { force: true });
});

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

const { default: app } = await import('../backend/src/app.js');
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// The server is *expected* to log the SMTP failure that it hides from the client, so the
// expected-503 calls mute stderr to keep the output readable.
const post = async (pathname, body, { muteServerError = false } = {}) => {
  const originalError = console.error;
  if (muteServerError) console.error = () => {};
  try {
    const res = await fetch(`${base}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
    return { status: res.status, body: text, payload };
  } finally {
    console.error = originalError;
  }
};

// "taken" stands in for a registered address, "unknown" for one that is not. They are
// just strings — the point is that the two must be indistinguishable.
const taken = { email: 'already-registered@example.com', password: 'secret123' };
const unknown = { email: 'never-seen-before@example.com', password: 'secret123' };

try {
  console.log('\n[1] register/request-code is uniform across addresses');
  const rTaken = await post('/api/auth/register/request-code', taken, { muteServerError: true });
  const rUnknown = await post('/api/auth/register/request-code', unknown, { muteServerError: true });
  check('registered  -> 503', rTaken.status === 503, `got ${rTaken.status}`);
  check('unknown     -> 503', rUnknown.status === 503, `got ${rUnknown.status}`);
  check('identical status', rTaken.status === rUnknown.status, `${rTaken.status} vs ${rUnknown.status}`);
  check('identical body', rTaken.body === rUnknown.body, `"${rTaken.body}" vs "${rUnknown.body}"`);
  check(
    'body mentions neither address nor account state',
    !/regist|exist|已验证|已注册|未注册/i.test(rTaken.body),
    rTaken.body
  );

  console.log('\n[2] password/request-reset-code is uniform across addresses');
  const pTaken = await post('/api/auth/password/request-reset-code', { email: taken.email }, { muteServerError: true });
  const pUnknown = await post('/api/auth/password/request-reset-code', { email: unknown.email }, { muteServerError: true });
  check('registered  -> 503', pTaken.status === 503, `got ${pTaken.status}`);
  check('unknown     -> 503', pUnknown.status === 503, `got ${pUnknown.status}`);
  check('identical status', pTaken.status === pUnknown.status, `${pTaken.status} vs ${pUnknown.status}`);
  check('identical body', pTaken.body === pUnknown.body, `"${pTaken.body}" vs "${pUnknown.body}"`);

  console.log('\n[3] the two endpoints agree with each other');
  check('same status across endpoints', rTaken.status === pTaken.status, `${rTaken.status} vs ${pTaken.status}`);
  check('same body across endpoints', rTaken.body === pTaken.body);

  console.log('\n[4] invalid input is still rejected (guard not blanket-503)');
  const bad = await post('/api/auth/register/request-code', { email: 'not-an-email', password: 'secret123' });
  check('bad email -> 400', bad.status === 400, `got ${bad.status}`);
} finally {
  await new Promise((resolve) => server.close(resolve));
  await cleanup();
}

// The HTTP assertions above cannot distinguish the branches without a real database: both
// probe addresses are unknown to it, so both take the "send an email" path. What actually
// makes the endpoints safe is the *ordering* — the mailer check has to happen before the
// account lookup, so its outcome cannot depend on the account. Assert that on the source,
// which is the property a future refactor is most likely to break by moving a line.
console.log('\n[5] mailer check is ordered before the account lookup');
const authSource = await fsp.readFile(new URL('../backend/src/routes/authRoutes.js', import.meta.url), 'utf8');
const handlerBlocks = [
  ["'/register/request-code'", "'/register/verify'"],
  ["'/password/request-reset-code'", "'/password/reset'"],
];
for (const [startMarker, endMarker] of handlerBlocks) {
  const start = authSource.indexOf(startMarker);
  const end = authSource.indexOf(endMarker, start + startMarker.length);
  check(`${startMarker} handler found`, start !== -1 && end > start);
  if (start === -1 || end <= start) continue;

  const block = authSource.slice(start, end);
  const mailerAt = block.indexOf('requireMailerReady(startedAt)');
  const lookupAt = block.search(/getUserByEmail\(email\)/);
  check('handler consults the mailer', mailerAt !== -1);
  check('handler looks up the account', lookupAt !== -1);
  check(
    'mailer check precedes the lookup',
    mailerAt !== -1 && lookupAt !== -1 && mailerAt < lookupAt,
    `mailer@${mailerAt} lookup@${lookupAt}`
  );
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES PRESENT'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
