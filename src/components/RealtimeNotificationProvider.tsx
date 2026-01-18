import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

export const RealtimeNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  useRealtimeNotifications();
  return <>{children}</>;
};
