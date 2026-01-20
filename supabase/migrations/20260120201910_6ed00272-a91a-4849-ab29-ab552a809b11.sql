-- Fix 1: login_history - Add permissive policies for authenticated users
-- Drop restrictive policies and recreate as permissive where appropriate

DROP POLICY IF EXISTS "Users can view own login history" ON public.login_history;
DROP POLICY IF EXISTS "Users can insert own login history" ON public.login_history;
DROP POLICY IF EXISTS "Deny anon access to login_history" ON public.login_history;

-- Create PERMISSIVE policies for authenticated users
CREATE POLICY "Authenticated users can view own login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert own login history"
ON public.login_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Keep RESTRICTIVE deny for anon role
CREATE POLICY "Deny anon SELECT on login_history"
ON public.login_history
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny anon INSERT on login_history"
ON public.login_history
FOR INSERT
TO anon
WITH CHECK (false);

-- Fix 2: invite_codes - Ensure proper role-based access
DROP POLICY IF EXISTS "Admins can view their own invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Admins can insert their own invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Admins can update their own invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Admins can delete their own invite codes" ON public.invite_codes;

-- Create PERMISSIVE policies for authenticated admins
CREATE POLICY "Admins can view own invite codes"
ON public.invite_codes
FOR SELECT
TO authenticated
USING ((admin_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert own invite codes"
ON public.invite_codes
FOR INSERT
TO authenticated
WITH CHECK ((admin_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update own invite codes"
ON public.invite_codes
FOR UPDATE
TO authenticated
USING ((admin_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete own invite codes"
ON public.invite_codes
FOR DELETE
TO authenticated
USING ((admin_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Block anon access to invite_codes
CREATE POLICY "Deny anon SELECT on invite_codes"
ON public.invite_codes
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny anon INSERT on invite_codes"
ON public.invite_codes
FOR INSERT
TO anon
WITH CHECK (false);