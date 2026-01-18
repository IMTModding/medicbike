import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface UserLocation extends Location {
  user_id: string;
  updated_at: string;
  is_active: boolean;
  full_name?: string;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const { user } = useAuth();
  const watchIdRef = useRef<number | null>(null);

  const startTracking = useCallback(async () => {
    if (!user) return;
    
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée');
      toast.error('Votre navigateur ne supporte pas la géolocalisation');
      return;
    }

    setIsTracking(true);
    
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const newLocation: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        setLocation(newLocation);
        setError(null);
        
        // Update location in database
        const { error: dbError } = await supabase
          .from('user_locations')
          .upsert({
            user_id: user.id,
            latitude: newLocation.latitude,
            longitude: newLocation.longitude,
            accuracy: newLocation.accuracy,
            updated_at: new Date().toISOString(),
            is_active: true
          }, {
            onConflict: 'user_id'
          });
        
        if (dbError) {
          console.error('Error updating location:', dbError);
        }
      },
      (err) => {
        setError(err.message);
        console.error('Geolocation error:', err);
      },
      options
    );
  }, [user]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    setIsTracking(false);
    
    // Mark as inactive in database
    if (user) {
      await supabase
        .from('user_locations')
        .update({ is_active: false })
        .eq('user_id', user.id);
    }
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    location,
    error,
    isTracking,
    startTracking,
    stopTracking
  };
};

export const useTeamLocations = () => {
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }

    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from('user_locations')
        .select(`
          user_id,
          latitude,
          longitude,
          accuracy,
          updated_at,
          is_active
        `)
        .eq('is_active', true)
        .gte('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()); // Last 15 minutes

      if (error) {
        console.error('Error fetching locations:', error);
        setLoading(false);
        return;
      }

      // Fetch profiles for names
      if (data && data.length > 0) {
        const userIds = data.map(loc => loc.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const locationsWithNames = data.map(loc => ({
          ...loc,
          full_name: profiles?.find(p => p.user_id === loc.user_id)?.full_name || 'Inconnu'
        }));

        setLocations(locationsWithNames);
      } else {
        setLocations([]);
      }
      
      setLoading(false);
    };

    fetchLocations();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('team-locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_locations'
        },
        () => {
          fetchLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  return { locations, loading };
};
