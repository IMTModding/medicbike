-- ========================================
-- FIX 1: user_roles - Allow admins to view organization member roles
-- ========================================

-- Add policy for admins and creators to view organization member roles
CREATE POLICY "Admins can view organization member roles"
ON public.user_roles
FOR SELECT
USING (
  -- Creators can see all roles
  is_creator(auth.uid())
  OR
  -- Admins can see roles of users in their organization
  (
    has_role(auth.uid(), 'admin'::app_role) 
    AND user_id IN (
      SELECT p.user_id 
      FROM profiles p 
      WHERE p.admin_id = auth.uid() 
      OR p.invite_code_id IN (
        SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = auth.uid()
      )
    )
  )
);

-- ========================================
-- FIX 2: profile_contacts - Ensure only owner and admins can access
-- The existing policies are correct, but we need to verify they are RESTRICTIVE
-- and add explicit creator access
-- ========================================

-- Drop and recreate the admin policy to include creators
DROP POLICY IF EXISTS "Admins can view organization contacts" ON public.profile_contacts;

CREATE POLICY "Admins and creators can view organization contacts"
ON public.profile_contacts
FOR SELECT
USING (
  -- Creators can see all contacts
  is_creator(auth.uid())
  OR
  -- Admins can see contacts of users in their organization
  (
    has_role(auth.uid(), 'admin'::app_role) 
    AND user_id IN (
      SELECT p.user_id 
      FROM profiles p 
      WHERE p.admin_id = auth.uid() 
      OR p.invite_code_id IN (
        SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = auth.uid()
      )
    )
  )
);