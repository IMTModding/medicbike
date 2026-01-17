-- Fix: Interventions should only be visible to users in the same organization as the creator
DROP POLICY IF EXISTS "Anyone authenticated can view interventions" ON public.interventions;

CREATE POLICY "Users can view interventions from their organization"
ON public.interventions FOR SELECT
TO authenticated
USING (
  -- User created this intervention
  created_by = auth.uid()
  -- Or intervention was created by someone in the same organization
  OR created_by IN (
    SELECT p.user_id FROM public.profiles p
    WHERE 
      -- Same invite code (same org employees)
      p.invite_code_id IN (SELECT invite_code_id FROM public.profiles WHERE user_id = auth.uid())
      -- Or created by the admin of user's org
      OR p.user_id IN (SELECT admin_id FROM public.profiles WHERE user_id = auth.uid())
      -- Or user is admin and creator is one of their employees
      OR p.admin_id = auth.uid()
  )
);

-- Fix: Intervention messages should only be visible to users who can see the intervention
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.intervention_messages;

CREATE POLICY "Users can view messages from their organization interventions"
ON public.intervention_messages FOR SELECT
TO authenticated
USING (
  intervention_id IN (
    SELECT i.id FROM public.interventions i
    WHERE 
      i.created_by = auth.uid()
      OR i.created_by IN (
        SELECT p.user_id FROM public.profiles p
        WHERE 
          p.invite_code_id IN (SELECT invite_code_id FROM public.profiles WHERE user_id = auth.uid())
          OR p.user_id IN (SELECT admin_id FROM public.profiles WHERE user_id = auth.uid())
          OR p.admin_id = auth.uid()
      )
  )
);