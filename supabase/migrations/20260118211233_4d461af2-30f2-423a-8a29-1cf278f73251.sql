-- Drop and recreate function with new return type including role
DROP FUNCTION IF EXISTS public.get_organization_profiles(uuid);

CREATE FUNCTION public.get_organization_profiles(p_user_id uuid)
RETURNS TABLE(
  admin_id uuid,
  avatar_url text,
  created_at timestamptz,
  email text,
  full_name text,
  id uuid,
  invite_code_id uuid,
  onboarding_completed boolean,
  phone text,
  user_id uuid,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if the calling user is an admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = p_user_id AND ur.role = 'admin'
  ) INTO v_is_admin;
  
  IF v_is_admin THEN
    -- Return all profiles in the organization (including the admin themselves)
    RETURN QUERY
    SELECT 
      p.admin_id,
      p.avatar_url,
      p.created_at,
      CASE 
        WHEN p.user_id = p_user_id THEN (SELECT au.email FROM auth.users au WHERE au.id = p.user_id)
        WHEN p.admin_id = p_user_id THEN (SELECT au.email FROM auth.users au WHERE au.id = p.user_id)
        WHEN p.invite_code_id IN (SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = p_user_id) THEN (SELECT au.email FROM auth.users au WHERE au.id = p.user_id)
        ELSE NULL
      END as email,
      p.full_name,
      p.id,
      p.invite_code_id,
      p.onboarding_completed,
      CASE 
        WHEN p.user_id = p_user_id THEN p.phone
        WHEN p.admin_id = p_user_id THEN p.phone
        WHEN p.invite_code_id IN (SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = p_user_id) THEN p.phone
        ELSE NULL
      END as phone,
      p.user_id,
      COALESCE((SELECT ur.role::text FROM user_roles ur WHERE ur.user_id = p.user_id LIMIT 1), 'employee') as role
    FROM profiles p
    WHERE 
      -- Include the admin themselves
      p.user_id = p_user_id
      -- Or employees linked to admin directly
      OR p.admin_id = p_user_id
      -- Or employees linked via invite code created by this admin
      OR p.invite_code_id IN (SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = p_user_id);
  ELSE
    -- Non-admin: only return own profile
    RETURN QUERY
    SELECT 
      p.admin_id,
      p.avatar_url,
      p.created_at,
      (SELECT au.email FROM auth.users au WHERE au.id = p.user_id) as email,
      p.full_name,
      p.id,
      p.invite_code_id,
      p.onboarding_completed,
      p.phone,
      p.user_id,
      COALESCE((SELECT ur.role::text FROM user_roles ur WHERE ur.user_id = p.user_id LIMIT 1), 'employee') as role
    FROM profiles p
    WHERE p.user_id = p_user_id;
  END IF;
END;
$$;