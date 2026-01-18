-- Fix secret retrieval in notification functions (vault.decrypted_secrets uses decrypted_secret, not value)

CREATE OR REPLACE FUNCTION public.notify_new_intervention()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payload JSONB;
  urgency_text TEXT;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Build urgency text
  CASE NEW.urgency
    WHEN 'high' THEN urgency_text := '🚨 URGENTE';
    WHEN 'medium' THEN urgency_text := '⚠️ Moyenne';
    ELSE urgency_text := 'ℹ️ Basse';
  END CASE;

  -- Build the payload
  payload := jsonb_build_object(
    'title', urgency_text || ' - ' || NEW.title,
    'body', NEW.location,
    'urgency', NEW.urgency,
    'interventionId', NEW.id,
    'senderUserId', NEW.created_by
  );

  -- Get secrets (Lovable Cloud Vault)
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  -- Call the backend function via pg_net (HTTP extension)
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


CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'title', '💬 ' || COALESCE(sender_name, 'Nouveau message'),
    'body', CASE WHEN length(NEW.message) > 50 THEN substring(NEW.message, 1, 50) || '...' ELSE NEW.message END,
    'type', 'chat',
    'organizationId', NEW.organization_id,
    'excludeUserId', NEW.user_id,
    'senderUserId', NEW.user_id
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


CREATE OR REPLACE FUNCTION public.notify_new_news()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payload JSONB;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only notify if the news is published
  IF NEW.published = true THEN
    payload := jsonb_build_object(
      'title', '📰 Nouvelle actualité',
      'body', NEW.title,
      'type', 'news',
      'newsId', NEW.id,
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
  END IF;

  RETURN NEW;
END;
$function$;