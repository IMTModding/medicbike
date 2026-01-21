-- Allow users to delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.general_messages
FOR DELETE
USING (user_id = auth.uid());