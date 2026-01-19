import { useState, useEffect, useRef } from 'react';
import { MapPin, Clock, AlertTriangle, CheckCircle2, XCircle, Navigation, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/services/interventions';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

export const AlertCard = ({ intervention, onStatusChange, onComplete }: AlertCardProps) => {
  const { isAdmin, user } = useAuth();
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const urgencyConfig = getUrgencyConfig(intervention.urgency);
  const timeAgo = getTimeAgo(intervention.created_at);
  
  const isResponded = intervention.userStatus === 'available' || intervention.userStatus === 'unavailable';

  // Start GPS tracking when user becomes available
  const startGpsTracking = async () => {
    if (!user || !navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { error: dbError } = await supabase
          .from('user_locations')
          .upsert({
            user_id: user.id,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
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
        console.error('Geolocation error:', err);
      },
      options
    );
  };

  // Cleanup GPS tracking on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleAvailable = async () => {
    // Start GPS tracking when user clicks "Dispo"
    await startGpsTracking();
    toast.success('GPS activé - Votre position est partagée');
    onStatusChange(intervention.id, 'available');
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
              ? "bg-success/10 text-success" 
              : "bg-muted text-muted-foreground"
          )}>
            {intervention.userStatus === 'available' ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Vous êtes disponible</span>
              </>
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
              onClick={handleAvailable}
            >
              <CheckCircle2 />
              Dispo
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
