
-- Move any leads currently in QC Pending back to Report Generated
UPDATE public.leads SET status = 'report_generation' WHERE status = 'report_qc_pending';

-- Remove QC Pending stage
DELETE FROM public.pipeline_stages WHERE slug = 'report_qc_pending';

-- Rename Report Generation
UPDATE public.pipeline_stages SET name = 'Report Generated' WHERE slug = 'report_generation';

-- Rename Closed stages
UPDATE public.pipeline_stages SET name = 'Closed (Onboarding)' WHERE slug = 'closed_won';
UPDATE public.pipeline_stages SET name = 'Lost' WHERE slug = 'closed_lost';

-- Recompact order_index
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS rn
  FROM public.pipeline_stages
)
UPDATE public.pipeline_stages ps SET order_index = r.rn
FROM ranked r WHERE ps.id = r.id;
