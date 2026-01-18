import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PresenceState {
  [key: string]: { user_id: string; online_at: string; current_page: string }[];
}

interface OnlineUser {
  user_id: string;
  online_at: string;
  current_page: string;
}

export const useGlobalPresence = (userId: string | undefined, currentPage: string) => {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  const [isTracking, setIsTracking] = useState(false);

  const updatePresence = useCallback(async (channel: ReturnType<typeof supabase.channel>) => {
    if (!userId) return;
    
    await channel.track({
      user_id: userId,
      online_at: new Date().toISOString(),
      current_page: currentPage,
    });
  }, [userId, currentPage]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('global-presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as PresenceState;
        const users = new Map<string, OnlineUser>();
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.user_id) {
              // Keep the most recent presence for each user
              const existing = users.get(presence.user_id);
              if (!existing || new Date(presence.online_at) > new Date(existing.online_at)) {
                users.set(presence.user_id, presence);
              }
            }
          });
        });
        
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsTracking(true);
          await updatePresence(channel);
        }
      });

    // Update presence when page changes
    const interval = setInterval(() => {
      updatePresence(channel);
    }, 30000); // Heartbeat every 30 seconds

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
      setIsTracking(false);
    };
  }, [userId, updatePresence]);

  // Update presence when current page changes
  useEffect(() => {
    if (!userId || !isTracking) return;
    
    const channel = supabase.channel('global-presence');
    updatePresence(channel);
  }, [currentPage, userId, isTracking, updatePresence]);

  const isUserOnline = useCallback((targetUserId: string): boolean => {
    return onlineUsers.has(targetUserId);
  }, [onlineUsers]);

  const getUserPresence = useCallback((targetUserId: string): OnlineUser | undefined => {
    return onlineUsers.get(targetUserId);
  }, [onlineUsers]);

  const getOnlineUserIds = useCallback((): string[] => {
    return Array.from(onlineUsers.keys());
  }, [onlineUsers]);

  const getOnlineCount = useCallback((): number => {
    return onlineUsers.size;
  }, [onlineUsers]);

  return {
    onlineUsers,
    isUserOnline,
    getUserPresence,
    getOnlineUserIds,
    getOnlineCount,
    isTracking,
  };
};
