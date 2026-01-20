import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { supabase } from '@/integrations/supabase/client';

// Register the plugin
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

// Check if running in native app
export const isNativeApp = () => {
  return Capacitor.isNativePlatform();
};

// Calculate distance between two coordinates in meters (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Start background tracking for an intervention
export const startBackgroundTracking = async (
  userId: string,
  interventionId: string,
  interventionTitle: string,
  targetLat: number,
  targetLon: number,
  onArrival: () => void
): Promise<string | null> => {
  if (!isNativeApp()) {
    console.log('Background geolocation only available in native app');
    return null;
  }

  try {
    // Add location watcher
    const watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'Suivi GPS pour intervention en cours',
        backgroundTitle: 'MedicBike - En route',
        requestPermissions: true,
        stale: false,
        distanceFilter: 50 // Update every 50 meters
      },
      async (location, error) => {
        if (error) {
          if (error.code === 'NOT_AUTHORIZED') {
            console.error('Location permission denied');
          }
          return;
        }

        if (!location) return;

        const { latitude, longitude, accuracy } = location;
        
        // Save location to database
        await supabase
          .from('user_locations')
          .upsert({
            user_id: userId,
            latitude,
            longitude,
            accuracy,
            updated_at: new Date().toISOString(),
            is_active: true
          }, {
            onConflict: 'user_id'
          });

        // Check if arrived (within 100 meters)
        const distance = calculateDistance(latitude, longitude, targetLat, targetLon);
        console.log('Background location - Distance to target:', distance, 'meters');

        if (distance <= 100) {
          // Save arrival event
          await supabase
            .from('intervention_events')
            .insert({
              intervention_id: interventionId,
              user_id: userId,
              event_type: 'arrival',
              latitude,
              longitude,
            });

          // Send arrival notification
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                type: 'arrival',
                interventionId,
                interventionTitle,
              },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
          }

          // Stop tracking
          await stopBackgroundTracking(watcherId);
          
          // Mark location as inactive
          await supabase
            .from('user_locations')
            .update({ is_active: false })
            .eq('user_id', userId);

          // Notify UI
          onArrival();
        }
      }
    );

    // Store watcher ID for later cleanup
    localStorage.setItem('activeWatcherId', watcherId);
    localStorage.setItem('activeInterventionId', interventionId);
    
    return watcherId;
  } catch (error) {
    console.error('Failed to start background tracking:', error);
    return null;
  }
};

// Stop background tracking
export const stopBackgroundTracking = async (watcherId?: string) => {
  if (!isNativeApp()) return;

  const id = watcherId || localStorage.getItem('activeWatcherId');
  if (id) {
    try {
      await BackgroundGeolocation.removeWatcher({ id });
      localStorage.removeItem('activeWatcherId');
      localStorage.removeItem('activeInterventionId');
    } catch (error) {
      console.error('Failed to stop background tracking:', error);
    }
  }
};

// Check if there's an active watcher
export const hasActiveTracking = () => {
  return !!localStorage.getItem('activeWatcherId');
};
