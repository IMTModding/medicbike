-- Fix login_history RLS policies - make them PERMISSIVE
DROP POLICY IF EXISTS "Users can only view their own login history" ON public.login_history;
DROP POLICY IF EXISTS "Users can only insert their own login history" ON public.login_history;

-- Recreate as PERMISSIVE policies (authenticated users only)
CREATE POLICY "Users can view own login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own login history"
ON public.login_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Re-fix profile_contacts to ensure policies are correct
DROP POLICY IF EXISTS "Users can view own contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Admins can view organization contacts" ON public.profile_contacts;

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