-- Drop the restrictive admin delete policy
DROP POLICY IF EXISTS "Admins can delete their events" ON public.events;

-- Create a more permissive delete policy for admins (org events) and creators (all events)
CREATE POLICY "Admins can delete organization events"
ON public.events
FOR DELETE
USING (
  is_creator(auth.uid()) 
  OR (
    has_role(auth.uid(), 'admin'::app_role) AND (
      admin_id = auth.uid()
      OR organization_id IN (SELECT id FROM invite_codes WHERE admin_id = auth.uid())
    )
  )
);