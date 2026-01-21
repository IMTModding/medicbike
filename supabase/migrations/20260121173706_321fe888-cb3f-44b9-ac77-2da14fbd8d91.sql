-- Drop the existing admin delete policy
DROP POLICY IF EXISTS "Admins can delete organization messages" ON public.general_messages;

-- Create new policy that allows admins (for their org) and creators (for all orgs) to delete any message
CREATE POLICY "Admins and creators can delete messages"
ON public.general_messages
FOR DELETE
USING (
  -- Creators can delete any message
  is_creator(auth.uid())
  OR
  -- Admins can delete messages in their organization
  (has_role(auth.uid(), 'admin'::app_role) AND (organization_id IN (
    SELECT invite_codes.id FROM invite_codes WHERE invite_codes.admin_id = auth.uid()
  )))
);