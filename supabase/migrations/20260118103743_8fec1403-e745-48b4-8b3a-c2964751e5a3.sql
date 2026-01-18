-- Table pour stocker les positions en temps réel des utilisateurs
CREATE TABLE public.user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Users can update their own location
CREATE POLICY "Users can insert their own location"
ON public.user_locations
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own location"
ON public.user_locations
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can view their own location"
ON public.user_locations
FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all locations
CREATE POLICY "Admins can view all locations"
ON public.user_locations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;

-- Create index for fast queries
CREATE INDEX idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX idx_user_locations_updated_at ON public.user_locations(updated_at DESC);