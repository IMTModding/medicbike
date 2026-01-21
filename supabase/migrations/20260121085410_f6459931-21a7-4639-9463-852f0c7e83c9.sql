-- Add reply_to_id column to intervention_messages
ALTER TABLE public.intervention_messages 
ADD COLUMN reply_to_id uuid REFERENCES public.intervention_messages(id) ON DELETE SET NULL;

-- Add reply_to_id column to general_messages
ALTER TABLE public.general_messages 
ADD COLUMN reply_to_id uuid REFERENCES public.general_messages(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_intervention_messages_reply_to ON public.intervention_messages(reply_to_id);
CREATE INDEX idx_general_messages_reply_to ON public.general_messages(reply_to_id);