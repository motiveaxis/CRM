-- Split contact_name into first_name / last_name and keep a generated contact_name
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_name text;

-- Backfill from existing contact_name (first token = first name, remainder = last name)
UPDATE public.leads
SET
  first_name = COALESCE(first_name, NULLIF(split_part(contact_name, ' ', 1), '')),
  last_name = COALESCE(
    last_name,
    NULLIF(
      CASE
        WHEN position(' ' in contact_name) > 0
        THEN substring(contact_name from position(' ' in contact_name) + 1)
        ELSE ''
      END,
      ''
    )
  )
WHERE contact_name IS NOT NULL;

-- Make first_name required going forward; last_name optional
ALTER TABLE public.leads ALTER COLUMN first_name SET NOT NULL;

-- Replace contact_name with a generated column derived from first + last (kept for compatibility)
ALTER TABLE public.leads DROP COLUMN contact_name;
ALTER TABLE public.leads
  ADD COLUMN contact_name text
  GENERATED ALWAYS AS (
    trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  ) STORED;