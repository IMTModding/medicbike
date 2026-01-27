-- Create trigger function for alerts table
CREATE OR REPLACE FUNCTION public.notify_new_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payload JSONB;
  supabase_url TEXT;
  service_key TEXT;
  sender_name TEXT;
BEGIN
  -- Get sender name
  SELECT full_name INTO sender_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Build the payload
  payload := jsonb_build_object(
    'title', '🔔 Nouvelle alerte',
    'body', COALESCE(sender_name, 'Utilisateur') || ': ' || NEW.message,
    'type', 'alert',
    'alertId', NEW.id,
    'senderUserId', NEW.user_id
  );

  -- Get secrets
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  -- Call the backend function via pg_net
  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := payload
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for alerts table
CREATE TRIGGER notify_new_alert_trigger
AFTER INSERT ON public.alerts
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_alert();

-- Create trigger function for emergency_alerts table
CREATE OR REPLACE FUNCTION public.notify_new_emergency_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payload JSONB;
  supabase_url TEXT;
  service_key TEXT;
  sender_name TEXT;
  location_text TEXT;
BEGIN
  -- Get sender name
  SELECT full_name INTO sender_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Build location text
  location_text := COALESCE(NEW.localisation, 'Position inconnue');

  -- Build the payload
  payload := jsonb_build_object(
    'title', '🚨 ALERTE URGENCE',
    'body', COALESCE(sender_name, 'Utilisateur') || ' - ' || location_text,
    'type', 'emergency',
    'urgency', 'high',
    'alertId', NEW.id,
    'senderUserId', NEW.user_id
  );

  -- Get secrets
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  -- Call the backend function via pg_net
  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := payload
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for emergency_alerts table
CREATE TRIGGER notify_new_emergency_alert_trigger
AFTER INSERT ON public.emergency_alerts
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_emergency_alert();