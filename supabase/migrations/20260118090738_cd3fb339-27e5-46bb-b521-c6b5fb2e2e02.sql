-- Create login_history table to track user logins
CREATE TABLE public.login_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  location TEXT
);

-- Enable RLS
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own login history
CREATE POLICY "Users can view their own login history"
ON public.login_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own login records
CREATE POLICY "Users can insert their own login history"
ON public.login_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add onboarding_completed column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add index for faster queries
CREATE INDEX idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX idx_login_history_login_at ON public.login_history(login_at DESC);