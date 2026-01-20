-- Create table for departure/arrival events
CREATE TABLE public.intervention_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('departure', 'arrival')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

-- Enable RLS
ALTER TABLE public.intervention_events ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_intervention_events_intervention_id ON public.intervention_events(intervention_id);
CREATE INDEX idx_intervention_events_user_id ON public.intervention_events(user_id);

-- RLS Policies
-- Users can insert their own events
CREATE POLICY "Users can insert their own events"
ON public.intervention_events
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can view events from their organization's interventions
CREATE POLICY "Organization members can view intervention events"
ON public.intervention_events
FOR SELECT
USING (
  intervention_id IN (
    SELECT i.id FROM interventions i
    WHERE i.created_by = auth.uid()
    OR i.created_by IN (
      SELECT p.user_id FROM profiles p
      WHERE p.invite_code_id IN (
        SELECT user_invite_code_id FROM get_user_organization_info(auth.uid())
      )
      OR p.user_id IN (
        SELECT user_admin_id FROM get_user_organization_info(auth.uid())
      )
      OR p.admin_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
  )
);

-- Admins can view all events
CREATE POLICY "Admins can view all events"
ON public.intervention_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'));