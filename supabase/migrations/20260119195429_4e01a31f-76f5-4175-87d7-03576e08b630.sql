-- Fix 1: profile_contacts - Add explicit block for anonymous users
-- The RESTRICTIVE policy only works with PERMISSIVE policies, so we need to ensure auth is required
DROP POLICY IF EXISTS "Deny anon access to profile_contacts" ON public.profile_contacts;

-- Create a proper policy that requires authentication for ALL operations
CREATE POLICY "Require authentication for profile_contacts"
ON public.profile_contacts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Fix 2: push_subscriptions - Add explicit block for anonymous users  
-- Ensure anonymous users cannot access push subscriptions at all
CREATE POLICY "Deny anon access to push_subscriptions"
ON public.push_subscriptions
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Fix 3: profiles - Simplify and secure the SELECT policy
-- Drop the complex policy and create a cleaner one
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create a simplified, secure policy
CREATE POLICY "Users can view own and organization profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User can always see their own profile
  user_id = auth.uid()
  -- Admin can see profiles they manage (direct admin_id or via invite codes they created)
  OR (
    has_role(auth.uid(), 'admin'::app_role) 
    AND (
      admin_id = auth.uid() 
      OR invite_code_id IN (SELECT id FROM invite_codes WHERE admin_id = auth.uid())
    )
  )
  -- Users in same organization (same invite_code_id)
  OR (
    invite_code_id IS NOT NULL 
    AND invite_code_id = (SELECT invite_code_id FROM profiles WHERE user_id = auth.uid())
  )
  -- Users can see their admin's profile
  OR (
    user_id = (SELECT admin_id FROM profiles WHERE user_id = auth.uid())
  )
);