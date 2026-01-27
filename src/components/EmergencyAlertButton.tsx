import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const EmergencyAlertButton = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const sendTestAlert = async () => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      // Get current location if available
      let latitude: number | null = null;
      let longitude: number | null = null;
      let localisation = 'Position non disponible';

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: true,
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          localisation = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        } catch (geoError) {
          console.log('Geolocation not available:', geoError);
        }
      }

      // Insert the emergency alert
      const { error } = await supabase
        .from('emergency_alerts')
        .insert({
          user_id: user.id,
          message: '🚨 ALERTE DE TEST - Ceci est un test du système d\'alerte d\'urgence',
          localisation,
          latitude,
          longitude,
        });

      if (error) throw error;

      setSuccess(true);
      toast.success('Alerte de test envoyée !');
      
      // Reset success state after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error sending emergency alert:', error);
      toast.error('Erreur lors de l\'envoi de l\'alerte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={success ? 'success' : 'destructive'}
      size="lg"
      className="w-full"
      onClick={sendTestAlert}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Envoi en cours...
        </>
      ) : success ? (
        <>
          <CheckCircle2 className="w-5 h-5" />
          Alerte envoyée !
        </>
      ) : (
        <>
          <AlertTriangle className="w-5 h-5" />
          Envoyer une alerte de test
        </>
      )}
    </Button>
  );
};
