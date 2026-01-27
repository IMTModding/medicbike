-- Create events table for manifestations/events
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  location TEXT,
  admin_id UUID NOT NULL,
  organization_id UUID REFERENCES public.invite_codes(id),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event availabilities table
CREATE TABLE public.event_availabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'maybe')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_availabilities ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at on events
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on event_availabilities  
CREATE TRIGGER update_event_availabilities_updated_at
  BEFORE UPDATE ON public.event_availabilities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for events table

-- Admins and creators can create events
CREATE POLICY "Admins and creators can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    (admin_id = auth.uid()) AND 
    (has_role(auth.uid(), 'admin') OR is_creator(auth.uid()))
  );

-- Admins can update their own events
CREATE POLICY "Admins can update their events"
  ON public.events FOR UPDATE
  USING (
    (admin_id = auth.uid() AND has_role(auth.uid(), 'admin')) OR 
    is_creator(auth.uid())
  );

-- Admins can delete their own events
CREATE POLICY "Admins can delete their events"
  ON public.events FOR DELETE
  USING (
    (admin_id = auth.uid() AND has_role(auth.uid(), 'admin')) OR 
    is_creator(auth.uid())
  );

-- Organization members can view events
CREATE POLICY "Organization members can view events"
  ON public.events FOR SELECT
  USING (
    is_creator(auth.uid()) OR
    admin_id = auth.uid() OR
    organization_id IN (
      SELECT invite_code_id FROM profiles WHERE user_id = auth.uid()
    ) OR
    admin_id IN (
      SELECT admin_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for event_availabilities table

-- Users can insert their own availability
CREATE POLICY "Users can insert their own availability"
  ON public.event_availabilities FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own availability
CREATE POLICY "Users can update their own availability"
  ON public.event_availabilities FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own availability
CREATE POLICY "Users can delete their own availability"
  ON public.event_availabilities FOR DELETE
  USING (user_id = auth.uid());

-- Organization members can view availabilities for events they can see
CREATE POLICY "Organization members can view event availabilities"
  ON public.event_availabilities FOR SELECT
  USING (
    user_id = auth.uid() OR
    event_id IN (
      SELECT id FROM public.events WHERE
        is_creator(auth.uid()) OR
        admin_id = auth.uid() OR
        organization_id IN (
          SELECT invite_code_id FROM profiles WHERE user_id = auth.uid()
        ) OR
        admin_id IN (
          SELECT admin_id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_availabilities;