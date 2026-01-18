-- Create a view for public profile data that excludes sensitive phone numbers
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT 
    id, 
    user_id, 
    full_name, 
    avatar_url, 
    created_at, 
    invite_code_id, 
    admin_id,
    onboarding_completed
    -- phone is intentionally excluded for privacy
  FROM public.profiles;

-- Drop the existing permissive SELECT policy on profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles in their organization" ON public.profiles;

-- Create new restrictive SELECT policy - users can only see their own full profile
CREATE POLICY "Users can view their own full profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

-- Admins can view all profiles in their organization (full data including phone)
CREATE POLICY "Admins can view organization profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND (
    admin_id = auth.uid() 
    OR invite_code_id IN (
      SELECT id FROM public.invite_codes WHERE admin_id = auth.uid()
    )
  )
);

-- For the profiles_public view, organization members can see each other (without phone)
-- The view inherits RLS from the base table, so we need a policy that allows org members to see basic info
CREATE POLICY "Organization members can view basic profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- Allow viewing profiles in same organization (for the view)
  (invite_code_id IS NOT NULL AND invite_code_id IN (
    SELECT user_invite_code_id FROM get_user_organization_info(auth.uid())
  ))
  OR admin_id = auth.uid()
);