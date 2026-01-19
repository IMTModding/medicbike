-- Drop the existing ambiguous policy
DROP POLICY IF EXISTS "Require authentication for profile_contacts" ON public.profile_contacts;

-- Create explicit deny policy for anonymous users
CREATE POLICY "Deny anon access to profile_contacts"
ON public.profile_contacts
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);