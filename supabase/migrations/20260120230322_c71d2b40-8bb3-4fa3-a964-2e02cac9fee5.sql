-- Update has_admin_privileges to include creator with full access
CREATE OR REPLACE FUNCTION public.has_admin_privileges(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('creator', 'admin')
  )
$$;

-- Create function to check if user is creator (full access to everything)
CREATE OR REPLACE FUNCTION public.is_creator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'creator'
  )
$$;

-- Update get_user_profile_access to give creator access to ALL profiles
CREATE OR REPLACE FUNCTION public.get_user_profile_access(requesting_user_id uuid)
RETURNS TABLE(accessible_user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- If user is creator, they can see ALL profiles
  SELECT p.user_id as accessible_user_id
  FROM profiles p
  WHERE is_creator(requesting_user_id)
  
  UNION
  
  -- Otherwise, use normal organization-based access
  SELECT p.user_id as accessible_user_id
  FROM profiles p
  WHERE NOT is_creator(requesting_user_id)
    AND (
      -- Own profile
      p.user_id = requesting_user_id
      -- Same organization (same invite_code_id)
      OR (p.invite_code_id IN (SELECT invite_code_id FROM profiles WHERE user_id = requesting_user_id AND invite_code_id IS NOT NULL))
      -- User's admin profile
      OR (p.user_id IN (SELECT admin_id FROM profiles WHERE user_id = requesting_user_id AND admin_id IS NOT NULL))
      -- Admin viewing their managed profiles
      OR (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = requesting_user_id AND role = 'admin')
        AND (
          p.admin_id = requesting_user_id 
          OR p.invite_code_id IN (SELECT id FROM invite_codes WHERE admin_id = requesting_user_id)
        )
      )
    );
$$;

-- Update get_organization_profiles to give creator access to ALL profiles
CREATE OR REPLACE FUNCTION public.get_organization_profiles(p_user_id uuid)
RETURNS TABLE(id uuid, user_id uuid, full_name text, avatar_url text, email text, phone text, created_at timestamp with time zone, invite_code_id uuid, admin_id uuid, onboarding_completed boolean, role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_creator boolean;
  v_user_invite_code_id uuid;
  v_user_admin_id uuid;
BEGIN
  -- Check if requesting user is creator (full access)
  SELECT is_creator(p_user_id) INTO v_is_creator;
  
  -- Check if requesting user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user_id AND ur.role = 'admin'
  ) INTO v_is_admin;

  -- Get user's organization info
  SELECT user_invite_code_id, user_admin_id
  INTO v_user_invite_code_id, v_user_admin_id
  FROM public.get_user_organization_info(p_user_id);

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.full_name,
    p.avatar_url,
    CASE
      WHEN v_is_creator OR v_is_admin OR p.user_id = p_user_id THEN pc.email
      ELSE NULL
    END AS email,
    CASE
      WHEN v_is_creator OR v_is_admin OR p.user_id = p_user_id THEN pc.phone
      ELSE NULL
    END AS phone,
    p.created_at,
    p.invite_code_id,
    p.admin_id,
    p.onboarding_completed,
    COALESCE((SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.user_id), 'employee') AS role
  FROM public.profiles p
  LEFT JOIN public.profile_contacts pc ON pc.user_id = p.user_id
  WHERE
    -- Creator can see ALL profiles
    v_is_creator
    -- User can see their own profile
    OR p.user_id = p_user_id
    -- Admin can see profiles of users they manage
    OR (v_is_admin AND (
      p.admin_id = p_user_id
      OR p.invite_code_id IN (SELECT ic.id FROM public.invite_codes ic WHERE ic.admin_id = p_user_id)
    ))
    -- Users can see profiles in same organization
    OR (v_user_invite_code_id IS NOT NULL AND p.invite_code_id = v_user_invite_code_id)
    -- Users can see their admin's profile
    OR (v_user_admin_id IS NOT NULL AND p.user_id = v_user_admin_id);
END;
$$;