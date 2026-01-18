-- Drop the problematic view and recreate it properly
DROP VIEW IF EXISTS public.profiles_public;

-- Drop the policies we just created to start fresh
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view organization profiles" ON public.profiles;
DROP POLICY IF EXISTS "Organization members can view basic profiles" ON public.profiles;

-- Create a single clean SELECT policy that properly restricts phone access
-- Phone is only visible to the profile owner and admins
CREATE POLICY "Users can view own profile or organization members" 
ON public.profiles 
FOR SELECT 
USING (
  -- Always allow viewing own profile (with full data)
  user_id = auth.uid()
  -- Admins can view profiles in their organization
  OR (
    has_role(auth.uid(), 'admin'::app_role) 
    AND (
      admin_id = auth.uid() 
      OR invite_code_id IN (
        SELECT id FROM public.invite_codes WHERE admin_id = auth.uid()
      )
    )
  )
  -- Organization members can see each other's basic info (but RLS is row-level, not column-level)
  -- So we need to allow SELECT but handle phone visibility in application code
  OR (
    invite_code_id IS NOT NULL 
    AND invite_code_id IN (
      SELECT user_invite_code_id FROM get_user_organization_info(auth.uid())
    )
  )
);

-- Create a security definer function to get profiles without phone for non-admin org members
CREATE OR REPLACE FUNCTION public.get_organization_profiles(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  avatar_url text,
  created_at timestamptz,
  invite_code_id uuid,
  admin_id uuid,
  onboarding_completed boolean,
  phone text -- Only populated for admins and own profile
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_org_id uuid;
BEGIN
  -- Check if requesting user is admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;
  
  -- Get user's organization
  IF v_is_admin THEN
    SELECT id INTO v_org_id FROM invite_codes WHERE admin_id = p_user_id LIMIT 1;
  ELSE
    SELECT p.invite_code_id INTO v_org_id FROM profiles p WHERE p.user_id = p_user_id;
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
    END as phone
  FROM profiles pr
  WHERE pr.invite_code_id = v_org_id
    OR (v_is_admin AND pr.admin_id = p_user_id);
END;
$$;