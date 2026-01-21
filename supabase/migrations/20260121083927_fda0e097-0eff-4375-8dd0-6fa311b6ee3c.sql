-- Drop existing policies on invite_codes
DROP POLICY IF EXISTS "Admins can insert own invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Admins can view own invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Admins can update own invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Admins can delete own invite codes" ON public.invite_codes;

-- Recreate policies to include creator role
CREATE POLICY "Admins and creators can insert invite codes"
ON public.invite_codes
FOR INSERT
TO authenticated
WITH CHECK (
  (admin_id = auth.uid()) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR is_creator(auth.uid()))
);

CREATE POLICY "Admins and creators can view invite codes"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (
  (admin_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role)) OR
  is_creator(auth.uid())
);

CREATE POLICY "Admins and creators can update invite codes"
ON public.invite_codes
FOR UPDATE
TO authenticated
USING (
  (admin_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role)) OR
  is_creator(auth.uid())
);

CREATE POLICY "Admins and creators can delete invite codes"
ON public.invite_codes
FOR DELETE
TO authenticated
USING (
  (admin_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role)) OR
  is_creator(auth.uid())
);