/**
 * One instance per browser tab, even across a hot reload.
 *
 * Vite's HMR replaces a module by *evaluating a new copy of it*; the old copy is not
 * destroyed, and anything it created — a socket, a store, a set of listeners — keeps
 * running. For ordinary modules that is invisible. For the ones that hold the single
 * source of truth about something live it is not: two copies of a store means the pill
 * reads one and the cancel clears the other, and two copies of the socket tracker means
 * every event is handled twice.
 *
 * That is a development-only problem, but it costs development-only *time* — a session
 * spent chasing "Stop does not work" in a tab that was holding two of everything, while a
 * fresh tab behaved perfectly. Anything module-level and live goes through here.
 *
 * In production the module is evaluated once and this is a plain lazy initialiser.
 */
const store: Record<string, unknown> = ((globalThis as Record<string, unknown>)['__perfscope_singletons__'] ??= {}) as Record<string, unknown>;

export function hmrSingleton<T>(key: string, create: () => T): T {
  if (!(key in store)) store[key] = create();
  return store[key] as T;
}

/** For flags rather than objects: "has this already been done in this tab?" */
export function oncePerTab(key: string): boolean {
  if (store[key]) return false;
  store[key] = true;
  return true;
}
