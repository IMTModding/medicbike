import React, { createContext, useContext, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useGlobalPresence } from '@/hooks/useGlobalPresence';

interface OnlineUser {
  user_id: string;
  online_at: string;
  current_page: string;
}

interface PresenceContextType {
  onlineUsers: Map<string, OnlineUser>;
  isUserOnline: (userId: string) => boolean;
  getUserPresence: (userId: string) => OnlineUser | undefined;
  getOnlineUserIds: () => string[];
  getOnlineCount: () => number;
  isTracking: boolean;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  const presence = useGlobalPresence(user?.id, location.pathname);

  return (
    <PresenceContext.Provider value={presence}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = (): PresenceContextType => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
};
