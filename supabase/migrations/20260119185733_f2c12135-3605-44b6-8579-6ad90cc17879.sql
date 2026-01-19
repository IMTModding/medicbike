-- Add DELETE policy for admins on general_messages
CREATE POLICY "Admins can delete organization messages" 
ON public.general_messages 
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND (
    organization_id IN (
      SELECT id FROM invite_codes WHERE admin_id = auth.uid()
    )
  )
);