import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Create a unique channel with user's key
    const channel = supabase.channel('global-presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channelRef.current = channel;

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
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineUsers((prev) => {
          const updated = new Map(prev);
          newPresences.forEach((presence) => {
            const p = presence as unknown as OnlineUser;
            if (p.user_id) {
              updated.set(p.user_id, p);
            }
          });
          return updated;
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineUsers((prev) => {
          const updated = new Map(prev);
          leftPresences.forEach((presence) => {
            const p = presence as unknown as OnlineUser;
            if (p.user_id) {
              updated.delete(p.user_id);
            }
          });
          return updated;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsTracking(true);
          // Track our presence
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            current_page: currentPage,
          });
        }
      });

    // Heartbeat every 30 seconds to keep presence active
    const interval = setInterval(async () => {
      if (channelRef.current) {
        await channelRef.current.track({
          user_id: userId,
          online_at: new Date().toISOString(),
          current_page: currentPage,
        });
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
      channelRef.current = null;
      setIsTracking(false);
    };
  }, [userId]);

  // Update presence when current page changes
  useEffect(() => {
    if (!userId || !isTracking || !channelRef.current) return;
    
    channelRef.current.track({
      user_id: userId,
      online_at: new Date().toISOString(),
      current_page: currentPage,
    });
  }, [currentPage, userId, isTracking]);

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
