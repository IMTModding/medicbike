-- Drop and recreate the deny policy with both USING and WITH CHECK
DROP POLICY IF EXISTS "Deny anon access to user_locations" ON public.user_locations;

-- Create a proper deny-all policy for anonymous users
CREATE POLICY "Deny anon access to user_locations"
ON public.user_locations
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);