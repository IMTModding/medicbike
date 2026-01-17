-- Table pour les disponibilités des employés
CREATE TABLE public.availabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, start_time)
);

-- Enable RLS
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own availabilities" 
ON public.availabilities FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own availabilities" 
ON public.availabilities FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own availabilities" 
ON public.availabilities FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own availabilities" 
ON public.availabilities FOR DELETE 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all availabilities" 
ON public.availabilities FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Table pour les messages des interventions
CREATE TABLE public.intervention_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intervention_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view messages" 
ON public.intervention_messages FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own messages" 
ON public.intervention_messages FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.intervention_messages;

-- Add coordinates to interventions for map
ALTER TABLE public.interventions 
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;