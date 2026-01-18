-- Fix security issues: Make profiles and interventions tables properly secured

-- Drop existing SELECT policies for profiles
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Create a more secure SELECT policy for profiles that requires authentication
CREATE POLICY "Authenticated users can view profiles in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User's own profile
  user_id = auth.uid()
  -- Or user is the admin of this profile
  OR admin_id = auth.uid()
  -- Or same organization (via invite_code_id)
  OR (
    invite_code_id IS NOT NULL 
    AND invite_code_id IN (
      SELECT user_invite_code_id 
      FROM public.get_user_organization_info(auth.uid())
    )
  )
);

-- Drop existing SELECT policies for interventions
DROP POLICY IF EXISTS "Users can view interventions from their organization" ON public.interventions;

-- Create a more secure SELECT policy for interventions
CREATE POLICY "Authenticated users can view interventions from their organization"
ON public.interventions
FOR SELECT
TO authenticated
USING (
  -- User created this intervention
  created_by = auth.uid()
  -- Or intervention was created by someone in the same organization
  OR created_by IN (
    SELECT p.user_id 
    FROM public.profiles p
    WHERE 
      -- Same invite code (same org employees)
      p.invite_code_id IN (SELECT user_invite_code_id FROM public.get_user_organization_info(auth.uid()))
      -- Or created by the admin of user's org
      OR p.user_id IN (SELECT user_admin_id FROM public.get_user_organization_info(auth.uid()))
      -- Or user is admin and creator is one of their employees
      OR p.admin_id = auth.uid()
  )
);