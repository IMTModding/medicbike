-- Fix profiles table: restrict to authenticated users only
DROP POLICY IF EXISTS "Users can view own profile or organization members" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  (user_id = auth.uid()) 
  OR (
    (invite_code_id IS NOT NULL) 
    AND (invite_code_id IN (
      SELECT get_user_organization_info.user_invite_code_id
      FROM get_user_organization_info(auth.uid())
    ))
  ) 
  OR (
    has_role(auth.uid(), 'admin'::app_role) 
    AND (
      (admin_id = auth.uid()) 
      OR (invite_code_id IN (
        SELECT ic.id
        FROM invite_codes ic
        WHERE ic.admin_id = auth.uid()
      ))
    )
  )
);

-- Fix invite_codes table: restrict to authenticated users only
DROP POLICY IF EXISTS "Admins can view their own invite codes" ON public.invite_codes;

CREATE POLICY "Authenticated admins can view their own invite codes" 
ON public.invite_codes 
FOR SELECT 
TO authenticated
USING (admin_id = auth.uid());