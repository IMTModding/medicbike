-- Fix 1: Invite codes should only be readable by authenticated users
DROP POLICY IF EXISTS "Anyone can read active invite codes" ON public.invite_codes;

CREATE POLICY "Authenticated users can read active invite codes"
ON public.invite_codes FOR SELECT
TO authenticated
USING (is_active = true);

-- Fix 2: Profiles should only be visible within the same organization
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization"
ON public.profiles FOR SELECT
TO authenticated
USING (
  -- User can see their own profile
  user_id = auth.uid()
  -- Or profiles in the same organization (same invite_code_id)
  OR invite_code_id IN (
    SELECT invite_code_id FROM public.profiles WHERE user_id = auth.uid()
  )
  -- Or admin can see profiles of users they invited
  OR admin_id = auth.uid()
);