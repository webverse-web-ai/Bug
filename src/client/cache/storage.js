import { Platform } from 'react-native';

// Cross-platform key/value cache store. Web persists to localStorage (survives
// reloads); native keeps an in-memory map for the session (swap in MMKV/AsyncStorage
// later for cross-launch persistence). All access is best-effort and never throws.
const PREFIX = 'bug_cache_';
const mem = {};

export const cacheStorage = {
  get(key) {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const v = localStorage.getItem(PREFIX + key);
        return v ? JSON.parse(v) : null;
      }
    } catch {}
    return mem[key] ?? null;
  },
  set(key, value) {
    mem[key] = value;
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      }
    } catch {}
  },
  remove(key) {
    delete mem[key];
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(PREFIX + key);
      }
    } catch {}
  },
  clear() {
    for (const k of Object.keys(mem)) delete mem[k];
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
      }
    } catch {}
  },
};
