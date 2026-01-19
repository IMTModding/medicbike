-- Add UPDATE policy for users to edit their own messages
CREATE POLICY "Users can update their own messages" 
ON public.general_messages 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());