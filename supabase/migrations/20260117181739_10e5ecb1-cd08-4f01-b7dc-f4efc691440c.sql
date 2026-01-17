-- Create table for organization invite codes
CREATE TABLE public.invite_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(8) NOT NULL UNIQUE,
  admin_id UUID NOT NULL,
  organization_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Add organization link to profiles
ALTER TABLE public.profiles 
ADD COLUMN invite_code_id UUID REFERENCES public.invite_codes(id),
ADD COLUMN admin_id UUID;

-- Enable RLS on invite_codes
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Policies for invite_codes
CREATE POLICY "Anyone can read active invite codes"
ON public.invite_codes
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage their own invite codes"
ON public.invite_codes
FOR ALL
USING (admin_id = auth.uid());

-- Update profiles policy to allow setting invite_code_id and admin_id on insert
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Function to generate unique invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 6 character alphanumeric code
    new_code := upper(substr(md5(random()::text), 1, 6));
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM invite_codes WHERE code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;