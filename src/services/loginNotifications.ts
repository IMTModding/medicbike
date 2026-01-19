import { supabase } from '@/integrations/supabase/client';

export const sendLoginNotification = async (userId: string): Promise<boolean> => {
  try {
    // Get user profile to determine their name and organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, invite_code_id, admin_id')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.log('Could not fetch profile for login notification');
      return false;
    }

    // Get user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    // Only notify for employee logins (not admins)
    if (roleData?.role === 'admin') {
      console.log('Admin login - no notification needed');
      return false;
    }

    // Employee must be linked to an organization
    if (!profile.invite_code_id) {
      console.log('Employee not linked to organization');
      return false;
    }

    const employeeName = profile.full_name || 'Un employé';

    // Send notification to admin via edge function
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        title: '👤 Connexion employé',
        body: `${employeeName} vient de se connecter`,
        type: 'login',
        employeeUserId: userId,
        organizationId: profile.invite_code_id,
      },
    });

    if (error) {
      console.error('Error sending login notification:', error);
      return false;
    }

    console.log('Login notification sent for:', employeeName);
    return true;
  } catch (error) {
    console.error('Error sending login notification:', error);
    return false;
  }
};
