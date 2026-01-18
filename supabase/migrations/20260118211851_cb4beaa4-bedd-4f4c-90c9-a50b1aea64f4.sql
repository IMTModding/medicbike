-- Drop and recreate the function with proper type casting
DROP FUNCTION IF EXISTS get_organization_profiles(uuid);

CREATE OR REPLACE FUNCTION get_organization_profiles(p_user_id uuid)
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
BEGIN
  RETURN QUERY
  -- Get profiles of employees linked to admin's invite codes
  SELECT 
    p.admin_id,
    p.avatar_url,
    p.created_at,
    COALESCE(p.email, (SELECT au.email::text FROM auth.users au WHERE au.id = p.user_id)) as email,
    p.full_name,
    p.id,
    p.invite_code_id,
    p.onboarding_completed,
    p.phone,
    p.user_id,
    COALESCE((SELECT ur.role::text FROM user_roles ur WHERE ur.user_id = p.user_id LIMIT 1), 'employee') as role
  FROM profiles p
  WHERE p.invite_code_id IN (
    SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = p_user_id
  )
  
  UNION
  
  -- Also include the admin themselves
  SELECT 
    p.admin_id,
    p.avatar_url,
    p.created_at,
    COALESCE(p.email, (SELECT au.email::text FROM auth.users au WHERE au.id = p.user_id)) as email,
    p.full_name,
    p.id,
    p.invite_code_id,
    p.onboarding_completed,
    p.phone,
    p.user_id,
    COALESCE((SELECT ur.role::text FROM user_roles ur WHERE ur.user_id = p.user_id LIMIT 1), 'employee') as role
  FROM profiles p
  WHERE p.user_id = p_user_id;
END;
$$;