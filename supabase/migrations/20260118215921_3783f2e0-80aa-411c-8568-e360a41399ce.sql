-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_organization_profiles(uuid);

-- Create a secure function to get organization profiles with protected sensitive data
-- Only admins and profile owners can see email and phone numbers

CREATE OR REPLACE FUNCTION public.get_organization_profiles(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  avatar_url text,
  email text,
  phone text,
  created_at timestamptz,
  invite_code_id uuid,
  admin_id uuid,
  onboarding_completed boolean,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_user_invite_code_id uuid;
  v_user_admin_id uuid;
BEGIN
  -- Check if requesting user is admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = p_user_id AND ur.role = 'admin'
  ) INTO v_is_admin;
  
  -- Get user's organization info
  SELECT user_invite_code_id, user_admin_id 
  INTO v_user_invite_code_id, v_user_admin_id
  FROM get_user_organization_info(p_user_id);
  
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.avatar_url,
    -- Only show email if: user is admin, or viewing own profile
    CASE 
      WHEN v_is_admin OR p.user_id = p_user_id THEN p.email
      ELSE NULL
    END as email,
    -- Only show phone if: user is admin, or viewing own profile
    CASE 
      WHEN v_is_admin OR p.user_id = p_user_id THEN p.phone
      ELSE NULL
    END as phone,
    p.created_at,
    p.invite_code_id,
    p.admin_id,
    p.onboarding_completed,
    COALESCE((SELECT ur.role::text FROM user_roles ur WHERE ur.user_id = p.user_id), 'employee') as role
  FROM profiles p
  WHERE 
    -- User can see their own profile
    p.user_id = p_user_id
    -- Admin can see profiles of users they manage
    OR (v_is_admin AND (
      p.admin_id = p_user_id 
      OR p.invite_code_id IN (SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = p_user_id)
    ))
    -- Users can see profiles in same organization
    OR (v_user_invite_code_id IS NOT NULL AND p.invite_code_id = v_user_invite_code_id)
    -- Users can see their admin's profile
    OR (v_user_admin_id IS NOT NULL AND p.user_id = v_user_admin_id);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_organization_profiles(uuid) TO authenticated;