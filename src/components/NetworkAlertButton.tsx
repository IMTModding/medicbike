import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Wifi, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const NetworkAlertButton = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const sendNetworkAlert = async () => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('alerts')
        .insert({
          user_id: user.id,
          message: 'ALERTE RÉSEAU',
          status: 'pending',
        });

      if (error) throw error;

      setSuccess(true);
      toast.success('Alerte réseau envoyée !');
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error sending network alert:', error);
      toast.error('Erreur lors de l\'envoi de l\'alerte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={success ? 'success' : 'default'}
      size="lg"
      className="w-full"
      onClick={sendNetworkAlert}
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
          <Wifi className="w-5 h-5" />
          ALERTE RÉSEAU
        </>
      )}
    </Button>
  );
};
