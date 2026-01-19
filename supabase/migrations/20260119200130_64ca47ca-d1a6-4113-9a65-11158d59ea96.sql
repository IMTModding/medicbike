-- Ensure user_locations supports upsert by user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_locations_user_id_key'
      AND conrelid = 'public.user_locations'::regclass
  ) THEN
    ALTER TABLE public.user_locations
      ADD CONSTRAINT user_locations_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Optional: keep updated_at current via default already set; no trigger needed
