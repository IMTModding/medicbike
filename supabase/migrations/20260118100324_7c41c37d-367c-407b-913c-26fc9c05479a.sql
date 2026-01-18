-- Allow creators to delete their own interventions (in addition to admins)
DO $$
BEGIN
  -- Create policy only if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
      AND tablename = 'interventions'
      AND policyname = 'Creators can delete their interventions'
  ) THEN
    CREATE POLICY "Creators can delete their interventions"
      ON public.interventions
      FOR DELETE
      TO authenticated
      USING (created_by = auth.uid());
  END IF;
END $$;