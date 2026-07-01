
-- 1. Attachments table
CREATE TABLE public.support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.support_ticket_attachments TO authenticated;
GRANT ALL ON public.support_ticket_attachments TO service_role;

ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients see own ticket attachments"
ON public.support_ticket_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    JOIN public.clients c ON c.id = t.client_id
    WHERE t.id = support_ticket_attachments.ticket_id
      AND (c.portal_user_id = auth.uid() OR public.is_staff(auth.uid()))
  )
);

CREATE POLICY "clients insert own ticket attachments"
ON public.support_ticket_attachments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    JOIN public.clients c ON c.id = t.client_id
    WHERE t.id = support_ticket_attachments.ticket_id
      AND (c.portal_user_id = auth.uid() OR public.is_staff(auth.uid()))
  )
);

CREATE POLICY "staff delete attachments"
ON public.support_ticket_attachments FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

-- 2. Storage policies on ticket-attachments bucket
-- Path convention: <client_id>/<ticket_id>/<filename>
CREATE POLICY "ticket attachments read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.portal_user_id = auth.uid()
        AND c.id::text = split_part(name, '/', 1)
    )
  )
);

CREATE POLICY "ticket attachments upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments' AND (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.portal_user_id = auth.uid()
        AND c.id::text = split_part(name, '/', 1)
    )
  )
);

CREATE POLICY "ticket attachments delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ticket-attachments' AND public.is_staff(auth.uid()));

-- 3. Add webhook column to app_settings for ticket notifications
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS webhook_ticket_updated TEXT;

-- 4. Trigger: on ticket insert or status change, call n8n via pg_net if configured
CREATE OR REPLACE FUNCTION public.notify_ticket_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hook_url TEXT;
  payload JSONB;
  event_type TEXT;
BEGIN
  SELECT webhook_ticket_updated INTO hook_url FROM public.app_settings LIMIT 1;
  IF hook_url IS NULL OR hook_url = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    event_type := 'ticket_created';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    event_type := 'ticket_status_changed';
  ELSE
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'event', event_type,
    'ticket_id', NEW.ticket_id,
    'id', NEW.id,
    'client_id', NEW.client_id,
    'subject', NEW.subject,
    'status', NEW.status,
    'priority', NEW.priority,
    'previous_status', CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,
    'updated_at', NEW.updated_at
  );

  BEGIN
    PERFORM net.http_post(
      url := hook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'notify_ticket_webhook failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_webhook ON public.support_tickets;
CREATE TRIGGER trg_notify_ticket_webhook
AFTER INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_webhook();

-- 5. Enable pg_net if not enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 6. Realtime for attachments
ALTER TABLE public.support_ticket_attachments REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_attachments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. touch updated_at on support_tickets updates so status changes propagate
DROP TRIGGER IF EXISTS trg_touch_support_tickets ON public.support_tickets;
CREATE TRIGGER trg_touch_support_tickets
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
