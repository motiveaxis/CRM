// Single source of truth: HTML shown in preview iframe === HTML sent to n8n/Gotenberg.

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ReportSection {
  id: string;
  title: string;
  type: string;
  content?: string;
  data?: any;
  items?: any;
}

export interface ReportData {
  metadata?: Record<string, any>;
  sections?: ReportSection[];
}

export interface LeadLite {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  booking_status?: string | null;
  cta_source?: string | null;
}

const LOGO_URL = "https://storage.motiveaxis.com/motiveaxis-reports/brand/logo-dark.png";

export function generateReportHTML(reportData: ReportData, leadData?: LeadLite | null): string {
  const sections = reportData.sections || [];
  const meta = reportData.metadata || {};
  const leadName = leadData?.first_name || "there";
  void leadName;

  const sectionHTML = sections
    .map((s) => {
      const title = `<h2 class="section-title">${escapeHtml(s.title)}</h2>`;
      let body = "";
      switch (s.type) {
        case "text": {
          body = `<p class="text-content">${escapeHtml(s.content || "")}</p>`;
          break;
        }
        case "metrics": {
          const m = s.data || {};
          body = `<div class="metrics-grid">
            <div class="metric"><span class="metric-value">${escapeHtml(m.hours_lost_weekly ?? 0)}</span><span class="metric-label">Hours Lost / Week</span></div>
            <div class="metric"><span class="metric-value">${escapeHtml(m.hours_lost_monthly ?? 0)}</span><span class="metric-label">Hours Lost / Month</span></div>
            <div class="metric"><span class="metric-value">${escapeHtml(m.error_risk || "Medium")}</span><span class="metric-label">Error Risk</span></div>
          </div>
          <p class="bottleneck">${escapeHtml(m.bottleneck_description || "")}</p>`;
          break;
        }
        case "list": {
          const items = s.items || {};
          const triggers = (items.automation_triggers || []).map((t: string) => `<li>${escapeHtml(t)}</li>`).join("");
          const actions = (items.automation_actions || []).map((a: string) => `<li>${escapeHtml(a)}</li>`).join("");
          body = `<div class="list-group"><strong>Triggers:</strong><ul>${triggers}</ul></div>
          <div class="list-group"><strong>Actions:</strong><ul>${actions}</ul></div>
          <p class="efficiency"><strong>Expected Gain:</strong> ${escapeHtml(items.expected_efficiency_gain || "")}</p>`;
          break;
        }
        case "stack": {
          const stk = s.data || {};
          const ints = (stk.integrations || []).map((i: string) => `<span class="tag">${escapeHtml(i)}</span>`).join("");
          body = `<p class="primary-tool"><strong>Primary:</strong> ${escapeHtml(stk.primary_tool || "n8n")}</p>
          <div class="tags">${ints}</div>`;
          break;
        }
        case "phases": {
          const ph = s.data || {};
          body = `<p class="phase"><strong>Phase 1:</strong> ${escapeHtml(ph.phase1 || "")}</p>
          <p class="phase"><strong>Phase 2:</strong> ${escapeHtml(ph.phase2 || "")}</p>
          <p class="phase"><strong>Phase 3:</strong> ${escapeHtml(ph.phase3 || "")}</p>`;
          break;
        }
        case "roi": {
          const r = s.data || {};
          body = `<div class="roi-grid">
            <div class="roi-item"><span class="roi-value">${escapeHtml(r.hours_saved_monthly ?? 0)}</span><span class="roi-label">Hours Saved / Month</span></div>
            <div class="roi-item"><span class="roi-value">${escapeHtml(r.hours_saved_annually ?? 0)}</span><span class="roi-label">Hours Saved / Year</span></div>
            <div class="roi-item"><span class="roi-value">${escapeHtml(r.labor_cost_recovered_monthly_usd || "$0")}</span><span class="roi-label">Labor Cost / Month</span></div>
            <div class="roi-item"><span class="roi-value">${escapeHtml(r.payback_period_weeks ?? 0)}</span><span class="roi-label">Payback (Weeks)</span></div>
          </div>`;
          break;
        }
        case "pricing": {
          const p = s.data || {};
          body = `<div class="pricing-box">
            <div class="tier">${escapeHtml(p.recommended_tier || "Starter")}</div>
            <div class="price">${escapeHtml(p.price_display || "$2,000")}</div>
            <p class="rationale">${escapeHtml(p.rationale || "")}</p>
          </div>`;
          break;
        }
        case "list_items": {
          const li = (s.items || []).map((item: string, i: number) => `<li>${i + 1}. ${escapeHtml(item)}</li>`).join("");
          body = `<ol class="next-steps">${li}</ol>`;
          break;
        }
        default:
          body = `<pre class="text-content">${escapeHtml(JSON.stringify(s.data || s.content || ""))}</pre>`;
      }
      return `<section class="report-section">${title}${body}</section>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Report ${escapeHtml(meta.report_id || "")}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; background-color: #0A0A0A; color: #E5E5E7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1A1A1A; padding-bottom: 20px; margin-bottom: 30px; }
  .header img { height: 64px; }
  .header .report-id { color: #666; font-size: 12px; text-align: right; }
  .report-section { background-color: #1A1A1A; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
  .section-title { color: #FF001E; font-size: 18px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.5px; }
  .text-content { color: #E5E5E7; line-height: 1.6; font-size: 14px; margin: 0; white-space: pre-wrap; }
  .metrics-grid { display: flex; gap: 16px; margin-bottom: 16px; }
  .metric { background-color: #0A0A0A; padding: 16px; border-radius: 6px; flex: 1; text-align: center; }
  .metric-value { display: block; color: #FF001E; font-size: 24px; font-weight: bold; }
  .metric-label { display: block; color: #999; font-size: 11px; margin-top: 4px; }
  .bottleneck { color: #E5E5E7; line-height: 1.6; font-size: 14px; margin: 0; }
  .list-group { margin-bottom: 12px; }
  .list-group strong { color: #FF001E; }
  .list-group ul { padding-left: 20px; color: #E5E5E7; font-size: 14px; line-height: 1.8; margin: 6px 0; }
  .efficiency { color: #E5E5E7; font-size: 14px; margin: 0; }
  .primary-tool { color: #E5E5E7; margin: 0 0 12px; }
  .tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .tag { background-color: #0A0A0A; color: #FF001E; padding: 4px 12px; border-radius: 4px; font-size: 12px; }
  .phase { color: #E5E5E7; margin: 0 0 8px; font-size: 14px; line-height: 1.6; }
  .phase strong { color: #FF001E; }
  .roi-grid { display: flex; gap: 16px; flex-wrap: wrap; }
  .roi-item { background-color: #0A0A0A; padding: 16px; border-radius: 6px; flex: 1; min-width: 120px; text-align: center; }
  .roi-value { display: block; color: #FF001E; font-size: 20px; font-weight: bold; }
  .roi-label { display: block; color: #999; font-size: 10px; margin-top: 4px; }
  .pricing-box { background-color: #0A0A0A; padding: 24px; border-radius: 6px; text-align: center; border: 1px solid #FF001E; }
  .tier { color: #FF001E; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
  .price { color: #E5E5E7; font-size: 32px; font-weight: bold; margin: 8px 0; }
  .rationale { color: #999; font-size: 12px; line-height: 1.6; margin: 0; }
  .next-steps { padding-left: 20px; color: #E5E5E7; font-size: 14px; line-height: 2; margin: 0; list-style: none; }
  .footer { border-top: 1px solid #1A1A1A; padding-top: 20px; margin-top: 30px; text-align: center; }
  .footer img { height: 32px; }
  .footer p { color: #666; font-size: 11px; margin-top: 8px; }
</style></head>
<body>
  <div class="header">
    <img src="${LOGO_URL}" alt="MotiveAxis"/>
    <div class="report-id">Report ${escapeHtml(meta.report_id || "")}<br/>${escapeHtml(meta.vertical || "")}</div>
  </div>
  ${sectionHTML}
  <div class="footer">
    <img src="${LOGO_URL}" alt="MotiveAxis"/>
    <p>MotiveAxis — We eliminate what slows you down. · motiveaxis.com</p>
  </div>
</body></html>`;
}
