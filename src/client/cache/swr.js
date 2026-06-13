import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { cacheStorage } from './storage';

// Tiny stale-while-revalidate layer: returns cached data instantly, then
// refreshes from the network in the background. Cache is shared across all
// components by key, deduped, and persisted (web) so navigation feels instant.

const mem = new Map();        // key -> { data, ts }
const inflight = new Map();   // key -> Promise
const subs = new Map();       // key -> Set<fn>

function read(key) {
  if (mem.has(key)) return mem.get(key);
  const persisted = cacheStorage.get(key);
  if (persisted && persisted.data !== undefined) { mem.set(key, persisted); return persisted; }
  return null;
}

function write(key, data) {
  const entry = { data, ts: Date.now() };
  mem.set(key, entry);
  cacheStorage.set(key, entry);
  const set = subs.get(key);
  if (set) set.forEach(fn => fn(entry));
}

async function revalidate(key, fetcher) {
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try { const data = await fetcher(); write(key, data); return data; }
    finally { inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}

// Optimistically update a cached key (e.g. after a local action).
export function mutate(key, updater) {
  const current = read(key)?.data;
  const next = typeof updater === 'function' ? updater(current) : updater;
  write(key, next);
}

export function clearCache() {
  mem.clear();
  inflight.clear();
  cacheStorage.clear();
}

export function useSWR(key, fetcher, { revalidateOnFocus = true } = {}) {
  const cached = key ? read(key) : null;
  const [data, setData] = useState(cached ? cached.data : undefined);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const fref = useRef(fetcher);
  fref.current = fetcher;

  const refresh = useCallback(async () => {
    if (!key) return;
    try { await revalidate(key, fref.current); setError(null); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  }, [key]);

  // Subscribe + initial revalidate.
  useEffect(() => {
    if (!key) return;
    const c = read(key);
    if (c) { setData(c.data); setLoading(false); }
    else setLoading(true);

    const fn = (entry) => { setData(entry.data); setLoading(false); };
    if (!subs.has(key)) subs.set(key, new Set());
    subs.get(key).add(fn);

    refresh();
    return () => { const s = subs.get(key); if (s) s.delete(fn); };
  }, [key, refresh]);

  // Refresh when the tab/app regains focus so shared (team) data stays current.
  useEffect(() => {
    if (!revalidateOnFocus || !key || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [key, refresh, revalidateOnFocus]);

  const localMutate = useCallback((updater) => key && mutate(key, updater), [key]);

  return { data, loading, error, refresh, mutate: localMutate };
}
