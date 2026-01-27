-- Create emergency_alerts table for storing emergency alerts
CREATE TABLE public.emergency_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  localisation TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own alerts
CREATE POLICY "Users can insert their own alerts"
ON public.emergency_alerts
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy: Users can view their own alerts
CREATE POLICY "Users can view their own alerts"
ON public.emergency_alerts
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Admins can view all alerts in their organization
CREATE POLICY "Admins can view all organization alerts"
ON public.emergency_alerts
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) AND (
    user_id IN (
      SELECT p.user_id FROM profiles p
      WHERE p.admin_id = auth.uid()
      OR p.invite_code_id IN (SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = auth.uid())
    )
  )
);

-- Policy: Creators can view all alerts
CREATE POLICY "Creators can view all alerts"
ON public.emergency_alerts
FOR SELECT
USING (is_creator(auth.uid()));

-- Enable realtime for emergency alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;