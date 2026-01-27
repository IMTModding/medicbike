-- Create database function to notify when a new event is created
CREATE OR REPLACE FUNCTION public.notify_new_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payload JSONB;
  supabase_url TEXT;
  service_key TEXT;
  event_date_formatted TEXT;
BEGIN
  -- Format the event date
  event_date_formatted := to_char(NEW.event_date, 'DD/MM/YYYY');

  -- Build the payload
  payload := jsonb_build_object(
    'title', '📅 Nouvel événement',
    'body', NEW.title || ' - ' || event_date_formatted,
    'type', 'event',
    'eventId', NEW.id,
    'organizationId', NEW.organization_id,
    'senderUserId', NEW.admin_id
  );

  -- Get secrets (Lovable Cloud Vault)
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
$function$;

-- Create trigger for automatic notification on new event
CREATE TRIGGER notify_new_event_trigger
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_event();