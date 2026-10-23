/**
 * Walks the remaining pages of a paginated list after the first page has already loaded.
 *
 * Extracted from the sync effect so the "did we actually see everything" question is
 * testable: hitting the page cap and running out of data have very different meanings for
 * the user, and the difference is easy to get wrong.
 */

export interface CollectPagesOptions<T> {
  /** Items already fetched for page 1. */
  firstPageItems: T[];
  pageSize: number;
  /** Hard cap on pages walked, to keep a stuck `hasMore` from looping forever. */
  maxPages: number;
  /** Parallel width once the probe page comes back full. */
  chunkSize: number;
  fetchPage: (page: number) => Promise<T[]>;
  /** Called with a fresh copy of everything collected so far, after each chunk. */
  onChunk?: (items: T[]) => void;
  /** Return false to abandon the walk because a newer sync superseded this one. */
  isActive?: () => boolean;
}

export interface CollectPagesResult<T> {
  items: T[];
  /** True only when the walk stopped at `maxPages` while pages were still coming back full. */
  truncated: boolean;
  /** True when `isActive()` returned false and the walk gave up. */
  aborted: boolean;
}

export const collectRemainingPages = async <T>(
  options: CollectPagesOptions<T>
): Promise<CollectPagesResult<T>> => {
  const { firstPageItems, pageSize, maxPages, chunkSize, fetchPage, onChunk } = options;
  const isActive = options.isActive ?? (() => true);

  const items = [...firstPageItems];
  let nextPage = 2;
  // Probe the first extra page alone: most libraries fit in two pages, and this avoids
  // firing a full parallel chunk on every sync when there is nothing left to fetch.
  let currentChunkSize = 1;
  let fetchedExtraPages = false;

  while (nextPage <= maxPages) {
    if (!isActive()) return { items, truncated: false, aborted: true };

    const pageCount = Math.min(currentChunkSize, maxPages - nextPage + 1);
    const pages = Array.from({ length: pageCount }, (_, idx) => nextPage + idx);
    const pageResults = await Promise.all(pages.map((page) => fetchPage(page)));

    let reachedLastPage = false;
    for (const pageItems of pageResults) {
      items.push(...pageItems);
      // A short page means there is nothing beyond it.
      if (pageItems.length < pageSize) {
        reachedLastPage = true;
        break;
      }
    }

    if (!isActive()) return { items, truncated: false, aborted: true };
    // Hand over a copy: callers store this in React state, and re-passing the same mutated
    // array would make the state update a no-op (Object.is comparison).
    onChunk?.([...items]);

    if (reachedLastPage) return { items, truncated: false, aborted: false };

    fetchedExtraPages = true;
    nextPage += pageCount;
    currentChunkSize = chunkSize;
  }

  // Exiting the loop means the cap was reached with every page still full. If page 1 was
  // the only page walked, the cap itself is pathological, so do not cry truncation.
  if (!fetchedExtraPages) return { items, truncated: false, aborted: false };
  if (!isActive()) return { items, truncated: false, aborted: true };

  // Probe exactly one page past the cap so "the library is exactly at the limit" is not
  // reported as truncation. The probe is a cheap read and its items are discarded: the cap
  // exists to bound memory, not to be exceeded by a diagnostic request.
  try {
    const beyond = await fetchPage(maxPages + 1);
    return { items, truncated: beyond.length > 0, aborted: false };
  } catch {
    // Cannot confirm either way. The walk did fill every page up to the cap, so warning is
    // the safer error: a needless hint beats letting someone think old memories vanished.
    return { items, truncated: true, aborted: false };
  }
};
