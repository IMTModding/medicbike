import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { 
  isPushSupported, 
  getNotificationPermission, 
  subscribeToPush,
  unsubscribeFromPush 
} from '@/services/pushNotifications';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const NotificationToggle = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  
  const { user } = useAuth();

  useEffect(() => {
    setSupported(isPushSupported());
    setPermission(getNotificationPermission());
  }, []);

  const handleToggle = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      if (permission === 'granted') {
        // Unsubscribe
        await unsubscribeFromPush(user.id);
        toast.success('Notifications désactivées');
        setPermission('default');
      } else {
        // Subscribe
        const success = await subscribeToPush(user.id);
        if (success) {
          toast.success('Notifications activées !');
          setPermission('granted');
        } else {
          // If the user granted permission but we still failed, it's usually setup/config.
          const current = getNotificationPermission();
          if (current === 'granted') {
            toast.error("Notifications non configurées sur cet appareil (clé VAPID manquante ou navigateur incompatible)");
          } else {
            toast.error("Impossible d'activer les notifications");
          }
        }
      }
    } catch (error) {
      console.error('Toggle error:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return null;
  }

  const isEnabled = permission === 'granted';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={loading || permission === 'denied'}
      className={cn(
        "relative",
        isEnabled && "text-primary"
      )}
      title={
        permission === 'denied' 
          ? 'Notifications bloquées dans les paramètres du navigateur'
          : isEnabled 
            ? 'Désactiver les notifications' 
            : 'Activer les notifications'
      }
    >
      {loading ? (
        <Bell className="w-5 h-5 animate-pulse" />
      ) : isEnabled ? (
        <BellRing className="w-5 h-5" />
      ) : (
        <BellOff className="w-5 h-5" />
      )}
      {isEnabled && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-success rounded-full" />
      )}
    </Button>
  );
};
