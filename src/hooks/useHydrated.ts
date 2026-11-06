import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR and hydration, true afterwards. Guards persisted client state. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
