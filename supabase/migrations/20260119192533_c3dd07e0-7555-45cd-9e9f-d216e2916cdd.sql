-- Ensure RLS is enabled and properly configured for all sensitive tables

-- 1. user_locations - ensure only authenticated users with proper permissions can access
DROP POLICY IF EXISTS "Users can view own location" ON public.user_locations;
DROP POLICY IF EXISTS "Admins can view consenting org user locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can insert their own location" ON public.user_locations;
DROP POLICY IF EXISTS "Users can update their own location" ON public.user_locations;

-- Block anon access entirely for user_locations
CREATE POLICY "Deny anon access to user_locations"
ON public.user_locations
FOR ALL
TO anon
USING (false);

-- Users can view their own location
CREATE POLICY "Authenticated users can view own location"
ON public.user_locations
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view consenting org user locations
CREATE POLICY "Admins can view consenting org user locations"
ON public.user_locations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND user_id IN (
    SELECT p.user_id 
    FROM profiles p
    WHERE p.location_sharing_enabled = true
    AND (
      p.admin_id = auth.uid() 
      OR p.invite_code_id IN (
        SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = auth.uid()
      )
    )
  )
);

-- Users can insert their own location
CREATE POLICY "Authenticated users can insert own location"
ON public.user_locations
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own location
CREATE POLICY "Authenticated users can update own location"
ON public.user_locations
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- 2. profile_contacts - block anon access
DROP POLICY IF EXISTS "Users can view own contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Admins can view organization contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON public.profile_contacts;

-- Block anon access entirely for profile_contacts
CREATE POLICY "Deny anon access to profile_contacts"
ON public.profile_contacts
FOR ALL
TO anon
USING (false);

-- Users can view their own contacts
CREATE POLICY "Authenticated users can view own contacts"
ON public.profile_contacts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view organization contacts
CREATE POLICY "Admins can view organization contacts"
ON public.profile_contacts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND user_id IN (
    SELECT p.user_id 
    FROM profiles p
    WHERE p.admin_id = auth.uid() 
    OR p.invite_code_id IN (
      SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = auth.uid()
    )
  )
);

-- Users can insert their own contacts
CREATE POLICY "Authenticated users can insert own contacts"
ON public.profile_contacts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own contacts
CREATE POLICY "Authenticated users can update own contacts"
ON public.profile_contacts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. login_history - block anon access
DROP POLICY IF EXISTS "Users can view own login history" ON public.login_history;
DROP POLICY IF EXISTS "Users can insert own login history" ON public.login_history;

-- Block anon access entirely for login_history
CREATE POLICY "Deny anon access to login_history"
ON public.login_history
FOR ALL
TO anon
USING (false);

-- Users can view their own login history
CREATE POLICY "Authenticated users can view own login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own login history
CREATE POLICY "Authenticated users can insert own login history"
ON public.login_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());