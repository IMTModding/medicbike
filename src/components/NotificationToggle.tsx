import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  ensurePushSubscription,
} from '@/services/pushNotifications';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const NotificationToggle = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const { user } = useAuth();

  const refreshState = useCallback(async () => {
    setSupported(isPushSupported());
    const p = getNotificationPermission();
    setPermission(p);

    if (!user) {
      setIsSubscribed(false);
      return;
    }

    // If permission is granted, ensure the browser subscription exists AND is saved to DB.
    if (p === 'granted') {
      const ok = await ensurePushSubscription(user.id);
      setIsSubscribed(ok);
    } else {
      setIsSubscribed(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const handleToggle = async () => {
    if (!user) return;

    setLoading(true);

    try {
      if (isSubscribed) {
        await unsubscribeFromPush(user.id);
        toast.success('Notifications désactivées');
        setIsSubscribed(false);
        setPermission(getNotificationPermission());
      } else {
        const success = await subscribeToPush(user.id);
        if (success) {
          toast.success('Notifications activées !');
          setIsSubscribed(true);
          setPermission('granted');
        } else {
          const current = getNotificationPermission();
          setPermission(current);
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

  if (!supported) return null;

  const isEnabled = isSubscribed && permission === 'granted';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={loading || permission === 'denied'}
      className={cn('relative', isEnabled && 'text-primary')}
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

