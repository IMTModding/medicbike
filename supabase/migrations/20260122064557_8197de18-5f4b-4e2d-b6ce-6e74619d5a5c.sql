-- Create table for FCM device tokens (native iOS/Android)
CREATE TABLE public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can insert their own FCM tokens"
ON public.fcm_tokens FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own FCM tokens"
ON public.fcm_tokens FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own FCM tokens"
ON public.fcm_tokens FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own FCM tokens"
ON public.fcm_tokens FOR DELETE
USING (user_id = auth.uid());

-- Service role needs full access for sending notifications
CREATE POLICY "Deny anon access to fcm_tokens"
ON public.fcm_tokens FOR ALL
USING (false)
WITH CHECK (false);

-- Trigger for updated_at
CREATE TRIGGER update_fcm_tokens_updated_at
BEFORE UPDATE ON public.fcm_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for fcm_tokens
ALTER PUBLICATION supabase_realtime ADD TABLE public.fcm_tokens;