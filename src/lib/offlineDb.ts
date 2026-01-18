import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface CachedIntervention {
  id: string;
  title: string;
  location: string;
  status: string;
  urgency: string;
  created_at: string;
  description?: string;
  userStatus?: string;
}

interface PendingAction {
  id: string;
  type: 'respond' | 'complete';
  interventionId: string;
  userId?: string;
  status?: string;
  timestamp: number;
}

interface MedicBikeDB extends DBSchema {
  interventions: {
    key: string;
    value: CachedIntervention;
    indexes: { 'by-status': string };
  };
  pendingActions: {
    key: string;
    value: PendingAction;
    indexes: { 'by-timestamp': number };
  };
  syncMeta: {
    key: string;
    value: { key: string; value: string | number };
  };
}

let dbInstance: IDBPDatabase<MedicBikeDB> | null = null;

export const getDb = async (): Promise<IDBPDatabase<MedicBikeDB>> => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MedicBikeDB>('medicbike-offline', 2, {
    upgrade(db, oldVersion) {
      // Interventions store
      if (!db.objectStoreNames.contains('interventions')) {
        const interventionStore = db.createObjectStore('interventions', { keyPath: 'id' });
        interventionStore.createIndex('by-status', 'status');
      }

      // Pending actions store
      if (!db.objectStoreNames.contains('pendingActions')) {
        const actionsStore = db.createObjectStore('pendingActions', { keyPath: 'id' });
        actionsStore.createIndex('by-timestamp', 'timestamp');
      }

      // Sync metadata store
      if (!db.objectStoreNames.contains('syncMeta')) {
        db.createObjectStore('syncMeta', { keyPath: 'key' });
      }
    }
  });

  return dbInstance;
};

// Interventions
export const cacheInterventions = async (interventions: CachedIntervention[]): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction('interventions', 'readwrite');
  
  // Clear existing and add new
  await tx.store.clear();
  for (const intervention of interventions) {
    await tx.store.put(intervention);
  }
  
  await tx.done;
  
  // Update last sync time
  await setMeta('lastSync', Date.now());
};

export const getCachedInterventions = async (): Promise<CachedIntervention[]> => {
  const db = await getDb();
  return db.getAll('interventions');
};

export const getCachedIntervention = async (id: string): Promise<CachedIntervention | undefined> => {
  const db = await getDb();
  return db.get('interventions', id);
};

// Pending Actions (offline queue)
export const addPendingAction = async (action: Omit<PendingAction, 'id' | 'timestamp'>): Promise<void> => {
  const db = await getDb();
  const id = `${action.type}-${action.interventionId}-${Date.now()}`;
  await db.put('pendingActions', {
    ...action,
    id,
    timestamp: Date.now()
  });
};

export const getPendingActions = async (): Promise<PendingAction[]> => {
  const db = await getDb();
  return db.getAllFromIndex('pendingActions', 'by-timestamp');
};

export const removePendingAction = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete('pendingActions', id);
};

export const clearPendingActions = async (): Promise<void> => {
  const db = await getDb();
  await db.clear('pendingActions');
};

// Sync Metadata
export const setMeta = async (key: string, value: string | number): Promise<void> => {
  const db = await getDb();
  await db.put('syncMeta', { key, value });
};

export const getMeta = async (key: string): Promise<string | number | undefined> => {
  const db = await getDb();
  const record = await db.get('syncMeta', key);
  return record?.value;
};

// Sync pending actions when online
export const syncPendingActions = async (
  respondToIntervention: (interventionId: string, userId: string, status: string) => Promise<void>,
  completeIntervention: (interventionId: string) => Promise<void>
): Promise<{ synced: number; failed: number }> => {
  const actions = await getPendingActions();
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      if (action.type === 'respond' && action.userId && action.status) {
        await respondToIntervention(action.interventionId, action.userId, action.status);
      } else if (action.type === 'complete') {
        await completeIntervention(action.interventionId);
      }
      
      await removePendingAction(action.id);
      synced++;
    } catch (error) {
      console.error('Failed to sync action:', action, error);
      failed++;
    }
  }

  return { synced, failed };
};
