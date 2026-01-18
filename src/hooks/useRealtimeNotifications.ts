import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const getUrgencyLabel = (urgency: string) => {
  switch (urgency) {
    case 'high': return '🚨 URGENT';
    case 'medium': return '⚠️ Moyen';
    case 'low': return '📋 Normal';
    default: return '📋';
  }
};

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const lastNotifiedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interventions',
        },
        (payload) => {
          const intervention = payload.new as any;
          
          // Avoid duplicate notifications
          if (lastNotifiedIdRef.current === intervention.id) return;
          lastNotifiedIdRef.current = intervention.id;
          
          // Don't notify if the user created this intervention
          if (intervention.created_by === user.id) return;
          
          const urgencyLabel = getUrgencyLabel(intervention.urgency);
          
          toast.info(
            `${urgencyLabel}: ${intervention.title}`,
            {
              description: `📍 ${intervention.location}`,
              duration: 10000,
              action: {
                label: 'Voir',
                onClick: () => navigate('/'),
              },
            }
          );

          // Play notification sound
          try {
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch (e) {
            // Audio not supported or file missing
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, navigate]);
};
