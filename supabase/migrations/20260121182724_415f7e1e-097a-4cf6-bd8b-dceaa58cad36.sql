-- Allow admins to view invite codes from their organization (not just codes they created)
DROP POLICY IF EXISTS "Admins and creators can view invite codes" ON public.invite_codes;

CREATE POLICY "Admins and creators can view invite codes" 
ON public.invite_codes 
FOR SELECT 
USING (
  -- Creators can see all codes
  is_creator(auth.uid())
  -- Admins can see codes they created
  OR ((admin_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  -- Admins can see codes from their organization (same invite_code_id)
  OR (has_role(auth.uid(), 'admin'::app_role) AND id IN (
    SELECT p.invite_code_id 
    FROM profiles p 
    WHERE p.user_id = auth.uid() AND p.invite_code_id IS NOT NULL
  ))
);