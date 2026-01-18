export async function resetPWAAndReload(): Promise<void> {
  try {
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }

    // Clear all caches
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // Clear storages
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }

    // Best-effort: clear IndexedDB databases if supported
    const anyIDB = indexedDB as any;
    if (anyIDB?.databases) {
      const dbs: Array<{ name?: string }> = await anyIDB.databases();
      await Promise.all(
        dbs
          .map((db) => db.name)
          .filter(Boolean)
          .map(
            (name) =>
              new Promise<void>((resolve) => {
                const req = indexedDB.deleteDatabase(name as string);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              })
          )
      );
    }
  } finally {
    // Hard reload
    window.location.replace(window.location.href);
  }
}
