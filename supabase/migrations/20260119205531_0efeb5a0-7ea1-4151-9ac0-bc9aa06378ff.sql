-- Push subscriptions: allow users to update their own rows (required for UPSERT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
      AND tablename = 'push_subscriptions'
      AND policyname = 'Users can update their own subscriptions'
  ) THEN
    CREATE POLICY "Users can update their own subscriptions"
    ON public.push_subscriptions
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;