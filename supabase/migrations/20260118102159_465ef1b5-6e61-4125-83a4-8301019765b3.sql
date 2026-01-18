-- Fix login_history security - ensure only authenticated users can access their own data
DROP POLICY IF EXISTS "Users can view their own login history" ON public.login_history;
DROP POLICY IF EXISTS "Users can insert their own login history" ON public.login_history;

-- Recreate with explicit TO authenticated
CREATE POLICY "Users can only view their own login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can only insert their own login history"
ON public.login_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Fix general_messages - add validation that user belongs to the organization
DROP POLICY IF EXISTS "Users can create messages" ON public.general_messages;

CREATE POLICY "Users can only create messages in their organization"
ON public.general_messages
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    -- User's organization_id matches their invite_code_id
    organization_id IN (
      SELECT invite_code_id FROM public.profiles WHERE user_id = auth.uid()
    )
    -- Or user is admin and organization_id is one of their invite codes
    OR organization_id IN (
      SELECT id FROM public.invite_codes WHERE admin_id = auth.uid()
    )
  )
);