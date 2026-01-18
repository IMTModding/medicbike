-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own availabilities" ON public.availabilities;

-- Create new policy allowing organization members to view each other's availabilities
CREATE POLICY "Organization members can view availabilities"
ON public.availabilities
FOR SELECT
USING (
  -- User can see their own availabilities
  user_id = auth.uid()
  OR
  -- User can see availabilities from same organization (via invite_code_id)
  user_id IN (
    SELECT p.user_id FROM profiles p
    WHERE p.invite_code_id IN (
      SELECT get_user_organization_info.user_invite_code_id
      FROM get_user_organization_info(auth.uid())
    )
  )
  OR
  -- Admin can see availabilities from their organization members
  user_id IN (
    SELECT p.user_id FROM profiles p
    WHERE p.admin_id = auth.uid()
    OR p.invite_code_id IN (
      SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = auth.uid()
    )
  )
);