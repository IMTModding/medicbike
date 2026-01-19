-- Fix profile_contacts RLS policies - change from RESTRICTIVE to PERMISSIVE
-- This allows either condition to grant access (user's own OR admin viewing org)

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view org contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Authenticated users can view own contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Authenticated users can insert own contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Authenticated users can update own contacts" ON public.profile_contacts;

-- Recreate as PERMISSIVE policies (default, any one can grant access)
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