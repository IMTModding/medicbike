import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useTwoFactor = () => {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkMfaStatus();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) {
        console.error('Error checking MFA status:', error);
        return;
      }

      // Check if there's a verified TOTP factor
      const hasVerifiedTotp = data.totp.some(factor => factor.status === 'verified');
      setIsEnabled(hasVerifiedTotp);
    } catch (error) {
      console.error('Error checking MFA:', error);
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    try {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      
      if (listError) throw listError;

      const totpFactor = data.totp[0];
      if (totpFactor) {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: totpFactor.id
        });
        
        if (error) throw error;
        setIsEnabled(false);
        return { success: true };
      }
      
      return { success: false, error: 'No factor found' };
    } catch (error: any) {
      console.error('Error disabling 2FA:', error);
      return { success: false, error: error.message };
    }
  };

  const refresh = () => {
    checkMfaStatus();
  };

  return {
    isEnabled,
    loading,
    disable2FA,
    refresh
  };
};
