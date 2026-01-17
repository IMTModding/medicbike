-- Create table for general chat messages
CREATE TABLE public.general_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  organization_id UUID REFERENCES public.invite_codes(id)
);

-- Enable RLS
ALTER TABLE public.general_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages from their organization
CREATE POLICY "Users can view organization messages"
ON public.general_messages
FOR SELECT
USING (
  organization_id IN (
    SELECT invite_code_id FROM public.profiles WHERE user_id = auth.uid()
  )
  OR
  organization_id IN (
    SELECT id FROM public.invite_codes WHERE admin_id = auth.uid()
  )
);

-- Policy: Users can create messages
CREATE POLICY "Users can create messages"
ON public.general_messages
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Enable realtime for general_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.general_messages;