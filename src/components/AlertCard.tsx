import { useState, useEffect, useRef } from 'react';
import { MapPin, Clock, AlertTriangle, CheckCircle2, XCircle, Navigation, Check, Car, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/services/interventions';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isNativeApp, startBackgroundTracking, stopBackgroundTracking } from '@/services/backgroundLocation';

interface AlertCardProps {
  intervention: Intervention;
  onStatusChange: (id: string, status: 'available' | 'unavailable') => void;
  onComplete?: (id: string) => void;
}

const getUrgencyConfig = (urgency: Intervention['urgency']) => {
  switch (urgency) {
    case 'high':
      return {
        label: 'Urgent',
        className: 'bg-urgent/20 text-urgent border-urgent/30',
        dotClass: 'bg-urgent pulse-urgent',
      };
    case 'medium':
      return {
        label: 'Moyen',
        className: 'bg-warning/20 text-warning border-warning/30',
        dotClass: 'bg-warning',
      };
    case 'low':
      return {
        label: 'Normal',
        className: 'bg-success/20 text-success border-success/30',
        dotClass: 'bg-success',
      };
  }
};

const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  
  return `Il y a ${Math.floor(diffHours / 24)}j`;
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

// Save event to database
const saveInterventionEvent = async (
  interventionId: string,
  userId: string,
  eventType: 'departure' | 'arrival',
  latitude?: number,
  longitude?: number
) => {
  try {
    const { error } = await supabase
      .from('intervention_events')
      .insert({
        intervention_id: interventionId,
        user_id: userId,
        event_type: eventType,
        latitude,
        longitude,
      });
    
    if (error) {
      console.error('Error saving intervention event:', error);
    }
  } catch (err) {
    console.error('Failed to save intervention event:', err);
  }
};

// Send departure/arrival notification
const sendStatusNotification = async (
  type: 'departure' | 'arrival',
  interventionId: string,
  interventionTitle: string
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        type,
        interventionId,
        interventionTitle,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('Error sending status notification:', error);
    }
  } catch (err) {
    console.error('Failed to send status notification:', err);
  }
};

export const AlertCard = ({ intervention, onStatusChange, onComplete }: AlertCardProps) => {
  const { isAdmin, user } = useAuth();
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [isDeparting, setIsDeparting] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const arrivalNotifiedRef = useRef(false);
  const urgencyConfig = getUrgencyConfig(intervention.urgency);
  const timeAgo = getTimeAgo(intervention.created_at);
  
  const isResponded = intervention.userStatus === 'available' || intervention.userStatus === 'unavailable';
  const hasDeparted = intervention.userStatus === 'available';

  // Check arrival based on GPS
  const checkArrival = (userLat: number, userLon: number) => {
    if (!intervention.latitude || !intervention.longitude) return false;
    
    const distance = calculateDistance(
      userLat, userLon,
      intervention.latitude, intervention.longitude
    );
    
    console.log('Distance to intervention:', distance, 'meters');
    
    // Consider arrived if within 100 meters
    return distance <= 100;
  };

  // Start GPS tracking with arrival detection
  const startGpsTracking = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!user) {
        toast.error('Utilisateur non connecté');
        resolve(false);
        return;
      }

      if (!navigator.geolocation) {
        toast.error('La géolocalisation n\'est pas supportée par votre navigateur');
        resolve(false);
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      };

      // First, get a single position to confirm GPS works
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log('GPS position obtained:', position.coords);
          
          const { latitude, longitude, accuracy } = position.coords;
          
          // Save departure event to database
          await saveInterventionEvent(
            intervention.id,
            user.id,
            'departure',
            latitude,
            longitude
          );
          
          // Save initial position
          const { error: dbError } = await supabase
            .from('user_locations')
            .upsert({
              user_id: user.id,
              latitude,
              longitude,
              accuracy,
              updated_at: new Date().toISOString(),
              is_active: true
            }, {
              onConflict: 'user_id'
            });
          
          if (dbError) {
            console.error('Error saving location:', dbError);
            toast.error('Erreur lors de l\'enregistrement de la position');
            resolve(false);
            return;
          }

          console.log('Location saved to database');

          // Then start watching for continuous updates with arrival detection
          watchIdRef.current = navigator.geolocation.watchPosition(
            async (pos) => {
              const { latitude, longitude, accuracy } = pos.coords;
              
              // Save position to DB
              await supabase
                .from('user_locations')
                .upsert({
                  user_id: user.id,
                  latitude,
                  longitude,
                  accuracy,
                  updated_at: new Date().toISOString(),
                  is_active: true
                }, {
                  onConflict: 'user_id'
                });
              
              // Check for arrival
              if (!arrivalNotifiedRef.current && checkArrival(latitude, longitude)) {
                arrivalNotifiedRef.current = true;
                setHasArrived(true);
                
                // Save arrival event to database
                await saveInterventionEvent(
                  intervention.id,
                  user.id,
                  'arrival',
                  latitude,
                  longitude
                );
                
                // Send arrival notification
                await sendStatusNotification('arrival', intervention.id, intervention.title);
                toast.success('🎯 Vous êtes arrivé sur les lieux !');
                
                // Stop tracking after arrival
                if (watchIdRef.current !== null) {
                  navigator.geolocation.clearWatch(watchIdRef.current);
                  watchIdRef.current = null;
                }
                
                // Mark location as inactive
                await supabase
                  .from('user_locations')
                  .update({ is_active: false })
                  .eq('user_id', user.id);
              }
            },
            (err) => {
              console.error('Watch position error:', err);
            },
            { ...options, maximumAge: 5000 } // Allow 5s cache for continuous tracking
          );

          resolve(true);
        },
        (err) => {
          console.error('Geolocation error:', err);
          switch (err.code) {
            case err.PERMISSION_DENIED:
              toast.error('Permission GPS refusée. Veuillez autoriser la géolocalisation dans les paramètres de votre navigateur.');
              break;
            case err.POSITION_UNAVAILABLE:
              toast.error('Position GPS indisponible. Vérifiez que le GPS est activé.');
              break;
            case err.TIMEOUT:
              toast.error('Délai d\'attente GPS dépassé. Réessayez.');
              break;
            default:
              toast.error('Erreur GPS: ' + err.message);
          }
          resolve(false);
        },
        options
      );
    });
  };

  // Cleanup GPS tracking on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      // Also cleanup native background tracking if active
      if (isNativeApp()) {
        stopBackgroundTracking();
      }
    };
  }, []);

  const handleDeparture = async () => {
    setIsDeparting(true);
    
    try {
      let gpsStarted = false;
      
      // Try native background tracking first (works when app is closed)
      if (isNativeApp() && intervention.latitude && intervention.longitude) {
        const watcherId = await startBackgroundTracking(
          user!.id,
          intervention.id,
          intervention.title,
          intervention.latitude,
          intervention.longitude,
          () => {
            setHasArrived(true);
            toast.success('🎯 Vous êtes arrivé sur les lieux !');
          }
        );
        
        if (watcherId) {
          gpsStarted = true;
          toast.success('🚗 Départ signalé - Suivi GPS en arrière-plan activé');
        }
      }
      
      // Fallback to web GPS tracking (only works when app is open)
      if (!gpsStarted) {
        gpsStarted = await startGpsTracking();
        
        if (gpsStarted) {
          toast.success('🚗 Départ signalé - GPS activé');
        } else {
          toast.warning('Départ signalé sans GPS');
        }
      }
      
      // Send departure notification
      await sendStatusNotification('departure', intervention.id, intervention.title);
      
      // Mark as available (departed)
      onStatusChange(intervention.id, 'available');
    } finally {
      setIsDeparting(false);
    }
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete(intervention.id);
    }
    setShowConfirmComplete(false);
  };

  const openGoogleMaps = () => {
    if (intervention.location) {
      const encodedAddress = encodeURIComponent(intervention.location);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
    }
  };

  const openWaze = () => {
    if (intervention.location) {
      const encodedAddress = encodeURIComponent(intervention.location);
      window.open(`https://waze.com/ul?navigate=yes&q=${encodedAddress}`, '_blank');
    }
  };

  return (
    <div 
      className={cn(
        "gradient-card rounded-xl border border-border p-4 slide-up",
        intervention.urgency === 'high' && !isResponded && "border-urgent/40"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", urgencyConfig.dotClass)} />
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full border",
            urgencyConfig.className
          )}>
            {urgencyConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock className="w-3 h-3" />
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
        {intervention.urgency === 'high' && (
          <AlertTriangle className="w-4 h-4 text-urgent" />
        )}
        {intervention.title}
      </h3>
      {intervention.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {intervention.description}
        </p>
      )}

      {/* Location with GPS Button */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{intervention.location}</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openGoogleMaps}
            className="flex-1 text-blue-400 border-blue-500/50 hover:bg-blue-500/20 hover:text-blue-300"
          >
            <Navigation className="w-4 h-4 mr-1" />
            Google Maps
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openWaze}
            className="flex-1 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/20 hover:text-cyan-300"
          >
            <Navigation className="w-4 h-4 mr-1" />
            Waze
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      {isResponded ? (
        <div className="space-y-2">
          <div className={cn(
            "flex items-center justify-center gap-2 py-3 rounded-lg",
            intervention.userStatus === 'available' 
              ? hasArrived 
                ? "bg-success/20 text-success"
                : "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}>
            {intervention.userStatus === 'available' ? (
              hasArrived ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Arrivé sur les lieux</span>
                </>
              ) : (
                <>
                  <Car className="w-5 h-5" />
                  <span className="font-medium">En route...</span>
                </>
              )
            ) : (
              <>
                <XCircle className="w-5 h-5" />
                <span className="font-medium">Indisponible</span>
              </>
            )}
          </div>
          {isAdmin && onComplete && (
            <Button
              variant="success"
              size="lg"
              className="w-full"
              onClick={() => setShowConfirmComplete(true)}
            >
              <Check className="w-4 h-4 mr-2" />
              Terminer l'intervention
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-3">
            <Button
              variant="available"
              size="xl"
              className="flex-1"
              onClick={handleDeparture}
              disabled={isDeparting}
            >
              {isDeparting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Car />
              )}
              Départ
            </Button>
            <Button
              variant="unavailable"
              size="xl"
              className="flex-1"
              onClick={() => onStatusChange(intervention.id, 'unavailable')}
            >
              <XCircle />
              Indisponible
            </Button>
          </div>
          {isAdmin && onComplete && (
            <Button
              variant="success"
              size="lg"
              className="w-full"
              onClick={() => setShowConfirmComplete(true)}
            >
              <Check className="w-4 h-4 mr-2" />
              Terminer l'intervention
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showConfirmComplete}
        onOpenChange={setShowConfirmComplete}
        title="Terminer l'intervention ?"
        description={`Êtes-vous sûr de vouloir marquer "${intervention.title}" comme terminée ? Cette action est irréversible.`}
        confirmLabel="Terminer"
        cancelLabel="Annuler"
        onConfirm={handleComplete}
      />
    </div>
  );
};
