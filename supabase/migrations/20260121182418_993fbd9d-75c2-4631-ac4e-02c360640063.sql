-- Fix: Admins should see all members in their organization, not just ones they personally invited
CREATE OR REPLACE FUNCTION public.get_organization_profiles(p_user_id uuid)
RETURNS TABLE(id uuid, user_id uuid, full_name text, avatar_url text, email text, phone text, created_at timestamp with time zone, invite_code_id uuid, admin_id uuid, onboarding_completed boolean, role text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
    -- Admin can see ALL profiles in their organization (same invite_code)
    OR (v_is_admin AND v_user_invite_code_id IS NOT NULL AND p.invite_code_id = v_user_invite_code_id)
    -- Admin can see profiles of users they directly manage
    OR (v_is_admin AND (
      p.admin_id = p_user_id
      OR p.invite_code_id IN (SELECT ic.id FROM public.invite_codes ic WHERE ic.admin_id = p_user_id)
    ))
    -- Admin can see their own admin's profile
    OR (v_is_admin AND v_user_admin_id IS NOT NULL AND p.user_id = v_user_admin_id)
    -- Regular users can see profiles in same organization
    OR (v_user_invite_code_id IS NOT NULL AND p.invite_code_id = v_user_invite_code_id)
    -- Users can see their admin's profile
    OR (v_user_admin_id IS NOT NULL AND p.user_id = v_user_admin_id);
END;
$$;