-- Remove admin access to push_subscriptions to prevent spam/abuse if an admin account is compromised
-- Edge functions use service role key so they can still send notifications

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.push_subscriptions;

-- Add a comment explaining the security decision
COMMENT ON TABLE public.push_subscriptions IS 'Push notification endpoints - only users can see their own subscriptions. Admins cannot directly access this table. Edge functions use service role for sending notifications.';
