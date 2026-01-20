-- Drop existing SELECT policy for intervention_messages
DROP POLICY IF EXISTS "Users can view messages from their organization interventions" ON public.intervention_messages;

-- Create more granular SELECT policy: only admins, creators, and assigned users can view messages
CREATE POLICY "Users can view messages for their assigned interventions"
ON public.intervention_messages
FOR SELECT
TO authenticated
USING (
  -- User is the message author
  user_id = auth.uid()
  -- OR user is admin
  OR has_role(auth.uid(), 'admin')
  -- OR user created the intervention
  OR intervention_id IN (
    SELECT id FROM public.interventions WHERE created_by = auth.uid()
  )
  -- OR user is assigned to this intervention
  OR intervention_id IN (
    SELECT intervention_id FROM public.intervention_assignments WHERE user_id = auth.uid()
  )
  -- OR user has responded to this intervention
  OR intervention_id IN (
    SELECT intervention_id FROM public.intervention_responses WHERE user_id = auth.uid()
  )
);