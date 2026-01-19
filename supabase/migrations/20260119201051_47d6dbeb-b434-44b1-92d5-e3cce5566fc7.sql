-- Drop existing policies on login_history
DROP POLICY IF EXISTS "Deny anon access to login_history" ON public.login_history;
DROP POLICY IF EXISTS "Authenticated users can insert own login history" ON public.login_history;
DROP POLICY IF EXISTS "Authenticated users can view own login history" ON public.login_history;

-- Create a more secure deny-all policy for anonymous users with both USING and WITH CHECK
CREATE POLICY "Deny anon access to login_history"
ON public.login_history
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Users can only view their own login history
CREATE POLICY "Users can view own login history"
ON public.login_history
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own login history (required for client-side recording)
CREATE POLICY "Users can insert own login history"
ON public.login_history
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Prevent updates and deletes entirely - login history should be immutable
CREATE POLICY "No updates to login_history"
ON public.login_history
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No deletes from login_history"
ON public.login_history
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (false);