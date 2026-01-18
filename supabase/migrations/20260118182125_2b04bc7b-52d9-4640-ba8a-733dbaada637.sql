-- Drop and recreate the vehicles SELECT policy to fix organization matching
DROP POLICY IF EXISTS "Organization members can view vehicles" ON public.vehicles;

CREATE POLICY "Organization members can view vehicles"
ON public.vehicles
FOR SELECT
USING (
  -- Admin can see their own vehicles
  admin_id = auth.uid()
  -- Users can see vehicles from their admin
  OR admin_id IN (
    SELECT p.admin_id FROM profiles p WHERE p.user_id = auth.uid()
  )
  -- Users can see vehicles linked to their organization
  OR organization_id IN (
    SELECT get_user_organization_info.user_invite_code_id
    FROM get_user_organization_info(auth.uid())
  )
  -- Users can see vehicles from their organization's admin
  OR admin_id IN (
    SELECT get_user_organization_info.user_admin_id
    FROM get_user_organization_info(auth.uid())
  )
);