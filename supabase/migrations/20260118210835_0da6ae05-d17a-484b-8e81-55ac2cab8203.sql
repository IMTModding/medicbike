-- Drop and recreate the function with new return type
DROP FUNCTION IF EXISTS public.get_organization_profiles(uuid);

-- Recreate the function with email column
CREATE OR REPLACE FUNCTION public.get_organization_profiles(p_user_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, full_name text, avatar_url text, created_at timestamp with time zone, invite_code_id uuid, admin_id uuid, onboarding_completed boolean, phone text, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_org_id uuid;
BEGIN
  -- Check if requesting user is admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = p_user_id AND ur.role = 'admin'
  ) INTO v_is_admin;
  
  -- Get user's organization
  IF v_is_admin THEN
    SELECT ic.id INTO v_org_id FROM invite_codes ic WHERE ic.admin_id = p_user_id LIMIT 1;
  ELSE
    SELECT pr.invite_code_id INTO v_org_id FROM profiles pr WHERE pr.user_id = p_user_id;
  END IF;
  
  RETURN QUERY
  SELECT 
    pr.id,
    pr.user_id,
    pr.full_name,
    pr.avatar_url,
    pr.created_at,
    pr.invite_code_id,
    pr.admin_id,
    pr.onboarding_completed,
    -- Only show phone to admins or for own profile
    CASE 
      WHEN v_is_admin OR pr.user_id = p_user_id THEN pr.phone
      ELSE NULL
    END as phone,
    -- Only show email to admins or for own profile
    CASE 
      WHEN v_is_admin OR pr.user_id = p_user_id THEN pr.email
      ELSE NULL
    END as email
  FROM profiles pr
  WHERE pr.invite_code_id = v_org_id
    OR (v_is_admin AND pr.admin_id = p_user_id);
END;
$function$;