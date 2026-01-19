-- Add restrictive policy to deny all anonymous access to user_roles
CREATE POLICY "Deny anon access to user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);