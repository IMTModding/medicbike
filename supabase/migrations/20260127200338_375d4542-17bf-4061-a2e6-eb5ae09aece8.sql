-- Add policy for creators to view ALL alerts globally
CREATE POLICY "Creators can view all alerts"
ON public.alerts
FOR SELECT
USING (is_creator(auth.uid()));

-- Add policy for creators to delete any alert
CREATE POLICY "Creators can delete any alert"
ON public.alerts
FOR DELETE
USING (is_creator(auth.uid()));

-- Add policy for admins to delete alerts from their organization members
CREATE POLICY "Admins can delete organization alerts"
ON public.alerts
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  user_id IN (
    SELECT p.user_id FROM profiles p
    WHERE p.admin_id = auth.uid()
    OR p.invite_code_id IN (SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = auth.uid())
  )
);

-- Users can delete their own alerts
CREATE POLICY "Users can delete their own alerts"
ON public.alerts
FOR DELETE
USING (user_id = auth.uid());

-- Same for emergency_alerts table
-- Add policy for admins to delete organization emergency alerts  
CREATE POLICY "Admins can delete organization emergency alerts"
ON public.emergency_alerts
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  user_id IN (
    SELECT p.user_id FROM profiles p
    WHERE p.admin_id = auth.uid()
    OR p.invite_code_id IN (SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = auth.uid())
  )
);

-- Creators can delete any emergency alert
CREATE POLICY "Creators can delete any emergency alert"
ON public.emergency_alerts
FOR DELETE
USING (is_creator(auth.uid()));

-- Users can delete their own emergency alerts
CREATE POLICY "Users can delete their own emergency alerts"
ON public.emergency_alerts
FOR DELETE
USING (user_id = auth.uid());