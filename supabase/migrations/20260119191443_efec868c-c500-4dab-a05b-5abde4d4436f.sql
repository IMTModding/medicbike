-- Fix invite_codes RLS policies - ensure only authenticated admins can view their own codes
DROP POLICY IF EXISTS "Authenticated admins can view their own invite codes" ON public.invite_codes;

-- Recreate as PERMISSIVE policy with proper authentication check
CREATE POLICY "Admins can view their own invite codes"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (admin_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role));

-- Fix profile_contacts - drop and recreate with proper PERMISSIVE policies
DROP POLICY IF EXISTS "Users can view own contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Admins can view organization contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON public.profile_contacts;

-- Create proper PERMISSIVE policies for profile_contacts
CREATE POLICY "Users can view own contacts"
ON public.profile_contacts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

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

CREATE POLICY "Users can insert own contacts"
ON public.profile_contacts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own contacts"
ON public.profile_contacts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());