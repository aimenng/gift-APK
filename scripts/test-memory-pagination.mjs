// Regression test for utils/memoryPagination.ts.
//
// Two things must stay true as the timeline grows:
//  1. Running out of pages and hitting the page cap must be distinguishable, so the UI can
//     warn "only the newest N are shown" without ever crying wolf when the list is complete.
//  2. Each onChunk call must hand over a *new* array. Re-passing the same mutated array to
//     a React setState is an Object.is no-op, which silently stops progressive loading.
//
// Runs on plain Node, no test framework. Requires Node >= 22.6.

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const NODE_MINOR = Number(process.versions.node.split('.')[1]);
if (NODE_MAJOR < 22 || (NODE_MAJOR === 22 && NODE_MINOR < 6)) {
  console.error(`needs Node >= 22.6 (running ${process.versions.node}).`);
  process.exit(1);
}

const { collectRemainingPages } = await import('../utils/memoryPagination.ts');

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

const PAGE_SIZE = 10;
const MAX_PAGES = 3; // so the walk can hold at most 30 items
const CHUNK = 2;

const build = (total) => {
  const store = Array.from({ length: total }, (_, i) => ({ id: i }));
  const requested = [];
  const fetchPage = async (page) => {
    requested.push(page);
    return store.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  };
  return { store, fetchPage, requested };
};

const run = async (total, overrides = {}) => {
  const { fetchPage, requested } = build(total);
  const firstPageItems = Array.from({ length: Math.min(total, PAGE_SIZE) }, (_, i) => ({ id: i }));
  const chunks = [];
  const result = await collectRemainingPages({
    firstPageItems,
    pageSize: PAGE_SIZE,
    maxPages: MAX_PAGES,
    chunkSize: CHUNK,
    fetchPage,
    onChunk: (items) => chunks.push(items),
    ...overrides,
  });
  return { result, requested, chunks, firstPageItems };
};

console.log('\n[1] nothing beyond page 1');
{
  const { result, requested } = await run(10);
  check('not truncated', result.truncated === false);
  check('not aborted', result.aborted === false);
  check('items are just page 1', result.items.length === 10, `got ${result.items.length}`);
  check('only page 2 was requested', JSON.stringify(requested) === '[2]', JSON.stringify(requested));
}

console.log('\n[2] exactly two pages');
{
  const { result } = await run(20);
  check('not truncated', result.truncated === false);
  check('items are both pages', result.items.length === 20, `got ${result.items.length}`);
}

console.log('\n[3] library ends exactly at the page cap (must NOT warn)');
{
  const { result, requested } = await run(30);
  check('not truncated', result.truncated === false, `truncated=${result.truncated}`);
  check('kept all 30', result.items.length === 30, `got ${result.items.length}`);
  check(
    'probed one page past the cap',
    requested.includes(MAX_PAGES + 1),
    JSON.stringify(requested)
  );
}

console.log('\n[4] more history than the cap allows (must warn)');
{
  const { result } = await run(40);
  check('truncated', result.truncated === true, `truncated=${result.truncated}`);
  check('kept exactly the cap', result.items.length === 30, `got ${result.items.length}`);
  check('no duplicate ids', new Set(result.items.map((m) => m.id)).size === 30);
}
{
  const { result } = await run(100);
  check('far beyond the cap: truncated', result.truncated === true);
  check('far beyond the cap: kept 30', result.items.length === 30, `got ${result.items.length}`);
}

console.log('\n[5] unconfirmable probe warns rather than staying silent');
{
  const { fetchPage } = build(40);
  const { result } = await run(40, {
    fetchPage: async (page) => {
      if (page === MAX_PAGES + 1) throw new Error('network down');
      return fetchPage(page);
    },
  });
  check('truncated on probe failure', result.truncated === true);
  check('kept the cap', result.items.length === 30, `got ${result.items.length}`);
}

console.log('\n[6] a superseded walk aborts without a verdict');
{
  let calls = 0;
  const { result } = await run(100, {
    isActive: () => {
      calls += 1;
      return calls < 2;
    },
  });
  check('aborted', result.aborted === true);
  check('no truncation verdict', result.truncated === false);
}

console.log('\n[7] onChunk hands over fresh arrays (React would skip a re-render otherwise)');
{
  const { chunks } = await run(100);
  check('called more than once', chunks.length >= 2, `got ${chunks.length}`);
  const refs = new Set(chunks);
  check('every call got a distinct array', refs.size === chunks.length, `${refs.size} vs ${chunks.length}`);
  check('sizes strictly increase', chunks.every((c, i) => i === 0 || c.length > chunks[i - 1].length));
  check('first chunk excludes page 1', chunks[0].length === 20, `got ${chunks[0].length}`);
}

console.log('\n[8] page requests are contiguous and each page is asked for once');
{
  const { requested } = await run(100);
  const extra = requested.filter((p) => p >= 2);
  check('no duplicates', new Set(extra).size === extra.length, JSON.stringify(extra));
  const sorted = [...extra].sort((a, b) => a - b);
  check('contiguous from page 2', sorted.every((p, i) => p === i + 2), JSON.stringify(sorted));
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES PRESENT'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
