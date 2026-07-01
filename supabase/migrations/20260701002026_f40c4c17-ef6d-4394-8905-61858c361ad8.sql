
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','credentials_vault','automations','api_connections','support_tickets','reports','deals']
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
