type Listener = (open: boolean) => void;
const listeners = new Set<Listener>();

export const drawerIsOpen = { current: false };

export function setDrawerOpen(open: boolean): void {
  drawerIsOpen.current = open;
  listeners.forEach(fn => fn(open));
}

export function subscribeDrawer(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
