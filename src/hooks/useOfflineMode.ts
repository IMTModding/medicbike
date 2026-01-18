import { useState, useEffect } from 'react';

interface CachedIntervention {
  id: string;
  title: string;
  location: string;
  status: string;
  urgency: string;
  created_at: string;
  description?: string;
}

const CACHE_KEY = 'medicbike_interventions_cache';
const CACHE_TIMESTAMP_KEY = 'medicbike_cache_timestamp';

export const useOfflineMode = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedInterventions, setCachedInterventions] = useState<CachedIntervention[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load cached data on mount
    loadCachedData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadCachedData = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setCachedInterventions(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  };

  const cacheInterventions = (interventions: CachedIntervention[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(interventions));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Error caching interventions:', error);
    }
  };

  const getCacheTimestamp = (): string | null => {
    return localStorage.getItem(CACHE_TIMESTAMP_KEY);
  };

  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    setCachedInterventions([]);
  };

  return {
    isOnline,
    cachedInterventions,
    cacheInterventions,
    getCacheTimestamp,
    clearCache,
    loadCachedData
  };
};
