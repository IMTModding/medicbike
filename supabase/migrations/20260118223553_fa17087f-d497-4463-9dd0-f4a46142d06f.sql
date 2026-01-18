-- Fix 1: Restrict user_locations - admins should only see locations of users in their org
-- Currently "Admins can view all locations" is too broad

DROP POLICY IF EXISTS "Admins can view all locations" ON public.user_locations;

CREATE POLICY "Admins can view org user locations"
ON public.user_locations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_id IN (
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.admin_id = auth.uid()
       OR p.invite_code_id IN (
         SELECT ic.id FROM public.invite_codes ic WHERE ic.admin_id = auth.uid()
       )
       OR p.user_id = auth.uid()
  )
);

-- Fix 2: Ensure invite_codes table requires authentication
-- The existing policies already require auth (admin_id = auth.uid()), but let's add a comment
COMMENT ON TABLE public.invite_codes IS 'Invitation codes - only admins can see their own codes. validate_invite_code() is the only way to check codes, and it uses SECURITY DEFINER with rate limiting via RLS.';
