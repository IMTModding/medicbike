import { supabase } from '@/integrations/supabase/client';

const getDeviceType = (): string => {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
};

export const recordLogin = async (userId: string) => {
  try {
    const deviceType = getDeviceType();
    const userAgent = navigator.userAgent;

    const { error } = await supabase
      .from('login_history')
      .insert({
        user_id: userId,
        device_type: deviceType,
        user_agent: userAgent,
      });

    if (error) {
      console.error('Error recording login:', error);
    }
  } catch (error) {
    console.error('Error recording login:', error);
  }
};
