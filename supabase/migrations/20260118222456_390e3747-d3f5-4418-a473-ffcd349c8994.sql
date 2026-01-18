-- Tighten access to sensitive contact info stored on public.profiles (email, phone)
-- Employees should not be able to read other members' email/phone directly.

-- 1) Replace the broad SELECT policy with safer policies
DROP POLICY IF EXISTS "Users can view own profile or organization members" ON public.profiles;

-- Users can always read their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

-- Admins can read profiles within their organization (including email/phone)
CREATE POLICY "Admins can view org profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (
    -- their own row
    user_id = auth.uid()
    OR
    -- rows that belong to the admin (directly) OR to one of the admin's invite codes
    admin_id = auth.uid()
    OR
    invite_code_id IN (
      SELECT ic.id
      FROM public.invite_codes ic
      WHERE ic.admin_id = auth.uid()
    )
  )
);

-- 2) Provide a safe, non-sensitive view for organization member directory use-cases
--    This view excludes email + phone.
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  id,
  user_id,
  admin_id,
  invite_code_id,
  full_name,
  avatar_url,
  onboarding_completed,
  created_at
FROM public.profiles;

-- Allow authenticated users to read the safe view
GRANT SELECT ON public.profiles_public TO authenticated;
