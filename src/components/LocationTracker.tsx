import { useGeolocation } from '@/hooks/useGeolocation';
import { Button } from '@/components/ui/button';
import { MapPin, MapPinOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const LocationTracker = () => {
  const { location, error, isTracking, startTracking, stopTracking } = useGeolocation();

  const handleToggle = async () => {
    if (isTracking) {
      await stopTracking();
      toast.info('Suivi GPS désactivé');
    } else {
      await startTracking();
      toast.success('Suivi GPS activé');
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isTracking ? 'bg-primary/20' : 'bg-muted'
          }`}>
            {isTracking ? (
              <MapPin className="w-5 h-5 text-primary" />
            ) : (
              <MapPinOff className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-medium text-foreground">Suivi GPS</p>
            <p className="text-xs text-muted-foreground">
              {isTracking 
                ? location 
                  ? `Position active (±${Math.round(location.accuracy || 0)}m)`
                  : 'Acquisition de position...'
                : 'Partager votre position'
              }
            </p>
          </div>
        </div>
        
        <Button
          variant={isTracking ? 'destructive' : 'default'}
          size="sm"
          onClick={handleToggle}
          disabled={error !== null && !isTracking}
        >
          {isTracking ? 'Désactiver' : 'Activer'}
        </Button>
      </div>
      
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </div>
  );
};

export default LocationTracker;
