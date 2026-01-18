-- Fix invite_codes table security
-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admins can view their own invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Admins can manage their own invite codes" ON public.invite_codes;

-- Create secure policies for invite_codes
CREATE POLICY "Admins can view their own invite codes"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (admin_id = auth.uid());

CREATE POLICY "Admins can insert their own invite codes"
ON public.invite_codes
FOR INSERT
TO authenticated
WITH CHECK (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update their own invite codes"
ON public.invite_codes
FOR UPDATE
TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete their own invite codes"
ON public.invite_codes
FOR DELETE
TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

-- Fix interventions table security - recreate SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view interventions from their organization" ON public.interventions;

CREATE POLICY "Organization members can view interventions"
ON public.interventions
FOR SELECT
TO authenticated
USING (
  -- User created this intervention
  created_by = auth.uid()
  -- Or intervention created by org member
  OR created_by IN (
    SELECT p.user_id 
    FROM public.profiles p
    WHERE 
      p.invite_code_id IN (SELECT user_invite_code_id FROM public.get_user_organization_info(auth.uid()))
      OR p.user_id IN (SELECT user_admin_id FROM public.get_user_organization_info(auth.uid()))
      OR p.admin_id = auth.uid()
  )
  -- Or user is admin
  OR public.has_role(auth.uid(), 'admin')
);