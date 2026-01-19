-- Fix the infinite recursion in profiles SELECT policy
-- The issue is that the policy references the profiles table within itself

DROP POLICY IF EXISTS "Users can view own and organization profiles" ON public.profiles;

-- Create a non-recursive policy using a security definer function
CREATE OR REPLACE FUNCTION public.get_user_profile_access(requesting_user_id uuid)
RETURNS TABLE(accessible_user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Get the requesting user's organization info first
  WITH user_org AS (
    SELECT invite_code_id, admin_id 
    FROM profiles 
    WHERE user_id = requesting_user_id
    LIMIT 1
  )
  SELECT p.user_id as accessible_user_id
  FROM profiles p, user_org
  WHERE 
    -- Own profile
    p.user_id = requesting_user_id
    -- Same organization (same invite_code_id)
    OR (user_org.invite_code_id IS NOT NULL AND p.invite_code_id = user_org.invite_code_id)
    -- User's admin profile
    OR (user_org.admin_id IS NOT NULL AND p.user_id = user_org.admin_id)
    -- Admin viewing their managed profiles
    OR (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = requesting_user_id AND role = 'admin')
      AND (
        p.admin_id = requesting_user_id 
        OR p.invite_code_id IN (SELECT id FROM invite_codes WHERE admin_id = requesting_user_id)
      )
    );
$$;

-- Create a simple policy that uses the function
CREATE POLICY "Users can view accessible profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT accessible_user_id FROM get_user_profile_access(auth.uid()))
);