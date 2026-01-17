-- Create a security definer function to get user's organization info without recursion
CREATE OR REPLACE FUNCTION public.get_user_organization_info(user_id_param UUID)
RETURNS TABLE (
  user_invite_code_id UUID,
  user_admin_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT invite_code_id, admin_id
  FROM public.profiles
  WHERE user_id = user_id_param
  LIMIT 1;
$$;

-- Fix: Profiles policy to avoid infinite recursion
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization"
ON public.profiles FOR SELECT
TO authenticated
USING (
  -- User can see their own profile
  user_id = auth.uid()
  -- Or admin can see profiles of users they invited
  OR admin_id = auth.uid()
  -- Or user is in the same organization
  OR invite_code_id IN (
    SELECT user_invite_code_id FROM public.get_user_organization_info(auth.uid())
  )
);

-- Fix: Interventions policy to use the security definer function
DROP POLICY IF EXISTS "Users can view interventions from their organization" ON public.interventions;

CREATE POLICY "Users can view interventions from their organization"
ON public.interventions FOR SELECT
TO authenticated
USING (
  -- User created this intervention
  created_by = auth.uid()
  -- Or intervention was created by someone in the same organization
  OR created_by IN (
    SELECT p.user_id FROM public.profiles p
    WHERE 
      -- Same invite code (same org employees)
      p.invite_code_id IN (SELECT user_invite_code_id FROM public.get_user_organization_info(auth.uid()))
      -- Or created by the admin of user's org
      OR p.user_id IN (SELECT user_admin_id FROM public.get_user_organization_info(auth.uid()))
      -- Or user is admin and creator is one of their employees
      OR p.admin_id = auth.uid()
  )
);

-- Fix: Intervention messages policy
DROP POLICY IF EXISTS "Users can view messages from their organization interventions" ON public.intervention_messages;

CREATE POLICY "Users can view messages from their organization interventions"
ON public.intervention_messages FOR SELECT
TO authenticated
USING (
  intervention_id IN (
    SELECT i.id FROM public.interventions i
    WHERE 
      i.created_by = auth.uid()
      OR i.created_by IN (
        SELECT p.user_id FROM public.profiles p
        WHERE 
          p.invite_code_id IN (SELECT user_invite_code_id FROM public.get_user_organization_info(auth.uid()))
          OR p.user_id IN (SELECT user_admin_id FROM public.get_user_organization_info(auth.uid()))
          OR p.admin_id = auth.uid()
      )
  )
);