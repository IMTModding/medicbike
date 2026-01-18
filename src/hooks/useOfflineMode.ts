import { useState, useEffect, useCallback } from 'react';
import { 
  cacheInterventions as dbCacheInterventions,
  getCachedInterventions,
  addPendingAction,
  getPendingActions,
  syncPendingActions,
  getMeta,
  setMeta
} from '@/lib/offlineDb';
import { toast } from 'sonner';

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

export const useOfflineMode = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedInterventions, setCachedInterventions] = useState<CachedIntervention[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const loadCachedData = useCallback(async () => {
    try {
      const cached = await getCachedInterventions();
      setCachedInterventions(cached);
      
      const pending = await getPendingActions();
      setPendingCount(pending.length);
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast.success('Connexion rétablie');
      
      // Auto-sync pending actions when back online
      const pending = await getPendingActions();
      if (pending.length > 0) {
        toast.info(`${pending.length} action(s) en attente de synchronisation`);
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Mode hors-ligne activé', {
        description: 'Vos actions seront synchronisées au retour de la connexion'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load cached data on mount
    loadCachedData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadCachedData]);

  const cacheInterventions = useCallback(async (interventions: CachedIntervention[]) => {
    try {
      await dbCacheInterventions(interventions);
      setCachedInterventions(interventions);
    } catch (error) {
      console.error('Error caching interventions:', error);
    }
  }, []);

  const getCacheTimestamp = useCallback(async (): Promise<string | null> => {
    try {
      const timestamp = await getMeta('lastSync');
      return timestamp ? new Date(timestamp as number).toISOString() : null;
    } catch {
      return null;
    }
  }, []);

  const queueOfflineAction = useCallback(async (
    type: 'respond' | 'complete',
    interventionId: string,
    userId?: string,
    status?: string
  ) => {
    await addPendingAction({ type, interventionId, userId, status });
    const pending = await getPendingActions();
    setPendingCount(pending.length);
    
    // Update local cache optimistically
    if (type === 'respond' && status) {
      setCachedInterventions(prev => 
        prev.map(i => i.id === interventionId ? { ...i, userStatus: status } : i)
      );
    }
    
    toast.info('Action enregistrée hors-ligne', {
      description: 'Elle sera synchronisée au retour de la connexion'
    });
  }, []);

  const syncOfflineActions = useCallback(async (
    respondFn: (interventionId: string, userId: string, status: string) => Promise<void>,
    completeFn: (interventionId: string) => Promise<void>
  ) => {
    const pending = await getPendingActions();
    if (pending.length === 0) return { synced: 0, failed: 0 };
    
    setSyncing(true);
    try {
      const result = await syncPendingActions(respondFn, completeFn);
      setPendingCount(0);
      
      if (result.synced > 0) {
        toast.success(`${result.synced} action(s) synchronisée(s)`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} action(s) ont échoué`);
      }
      
      return result;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    isOnline,
    cachedInterventions,
    cacheInterventions,
    getCacheTimestamp: () => {
      // Synchronous wrapper for backward compatibility
      let timestamp: string | null = null;
      getMeta('lastSync').then(t => {
        timestamp = t ? new Date(t as number).toISOString() : null;
      });
      return timestamp;
    },
    loadCachedData,
    pendingCount,
    syncing,
    queueOfflineAction,
    syncOfflineActions
  };
};
