-- Allow admins to view all intervention responses
CREATE POLICY "Admins can view all responses"
  ON public.intervention_responses FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));