-- Drop existing SELECT policies on profile_contacts to recreate with proper security
DROP POLICY IF EXISTS "Users can view own contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Admins can view org contacts" ON public.profile_contacts;

-- Recreate with explicit authentication requirement
CREATE POLICY "Authenticated users can view own contacts" 
ON public.profile_contacts 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view org contacts" 
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
      SELECT ic.id
      FROM invite_codes ic
      WHERE ic.admin_id = auth.uid()
    )
    OR p.user_id = auth.uid()
  )
);

-- Also update INSERT and UPDATE policies to be explicit about authenticated role
DROP POLICY IF EXISTS "Users can upsert own contacts" ON public.profile_contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON public.profile_contacts;

CREATE POLICY "Authenticated users can insert own contacts" 
ON public.profile_contacts 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users can update own contacts" 
ON public.profile_contacts 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());