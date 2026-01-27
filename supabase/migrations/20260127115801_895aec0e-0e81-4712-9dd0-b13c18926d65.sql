-- Create alerts table
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  user_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own alerts
CREATE POLICY "Users can insert their own alerts"
ON public.alerts
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy: Users can view their own alerts
CREATE POLICY "Users can view their own alerts"
ON public.alerts
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Admins can view all alerts
CREATE POLICY "Admins can view all alerts"
ON public.alerts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));