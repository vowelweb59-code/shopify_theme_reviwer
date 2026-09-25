import { getPageLabel } from "@/lib/audit/pageLabel";

export type PdfFindingRow = {
  ruleId: string;
  requirementId?: string | null;
  filePath: string;
  lineNumber?: number | null;
  category: string;
  severity: string;
  layer?: string | null;
  finding: string;
  recommendation?: string | null;
};

export type PdfSummary = {
  total: number;
  blocker: number;
  high: number;
  medium: number;
  low: number;
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const SEVERITY_COLOR: Record<string, string> = {
  blocker: "#b91c1c",
  high: "#c2410c",
  medium: "#b45309",
  low: "#52525b",
};

/**
 * Builds a self-contained, print-friendly HTML document for one audit run —
 * both the HTML export and the PDF export. PDF is produced by the browser's
 * own print engine ("Save as PDF") rather than a server-side headless
 * Chromium: `print: true` adds print page setup, a Print button, and opens
 * the print dialog on load. (Running Chromium on the server only for this
 * cost ~4 GB of Docker image and a memory spike per export.)
 */
export function buildReportHtml(opts: {
  themeName: string;
  auditRunId: string;
  startedAt: string;
  summary?: PdfSummary;
  findings: PdfFindingRow[];
  print?: boolean;
}): string {
  const { themeName, auditRunId, startedAt, summary, findings, print = false } = opts;

  const rows = findings
    .map(
      (f) => `
        <tr>
          <td style="color:${SEVERITY_COLOR[f.severity] ?? "#52525b"};font-weight:600;text-transform:capitalize;">${escapeHtml(f.severity)}</td>
          <td>${escapeHtml(f.category)}</td>
          <td style="font-size:11px;">${escapeHtml(getPageLabel(f.filePath) ?? "")}</td>
          <td style="font-family:monospace;font-size:11px;">${escapeHtml(f.filePath)}${f.lineNumber ? `:${f.lineNumber}` : ""}</td>
          <td>
            <div>${escapeHtml(f.finding)}</div>
            ${f.recommendation ? `<div style="color:#71717a;font-size:11px;margin-top:2px;">${escapeHtml(f.recommendation)}</div>` : ""}
          </td>
          <td style="font-size:11px;color:#71717a;">${escapeHtml(f.ruleId)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #18181b; margin: 32px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .meta { color: #71717a; font-size: 12px; margin-bottom: 20px; }
  .summary { display: flex; gap: 24px; margin-bottom: 24px; }
  .summary div { text-align: center; }
  .summary .n { font-size: 20px; font-weight: 700; }
  .summary .l { font-size: 11px; color: #71717a; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; border-bottom: 1px solid #d4d4d8; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #71717a; }
  td { border-bottom: 1px solid #e4e4e7; padding: 6px 8px; vertical-align: top; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  .toolbar { position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 8px; padding: 8px 0 16px; background: #fff; }
  .toolbar button { font: inherit; font-size: 13px; padding: 6px 14px; border-radius: 999px; border: 0; background: #4f46e5; color: #fff; cursor: pointer; }
  @page { size: A4; margin: 16px; }
  @media print { body { margin: 0; } .toolbar { display: none; } }
</style>
${print ? `<title>${escapeHtml(themeName)} audit ${escapeHtml(auditRunId)}</title>` : ""}
</head>
<body>
  ${print ? `<div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>` : ""}
  <h1>${escapeHtml(themeName)}</h1>
  <div class="meta">Audit ${escapeHtml(auditRunId)} — started ${escapeHtml(startedAt)}</div>
  ${
    summary
      ? `<div class="summary">
        <div><div class="n">${summary.total}</div><div class="l">Total</div></div>
        <div><div class="n">${summary.blocker}</div><div class="l">Blocker</div></div>
        <div><div class="n">${summary.high}</div><div class="l">High</div></div>
        <div><div class="n">${summary.medium}</div><div class="l">Medium</div></div>
        <div><div class="n">${summary.low}</div><div class="l">Low</div></div>
      </div>`
      : ""
  }
  <table>
    <thead><tr><th>Severity</th><th>Category</th><th>Page</th><th>File</th><th>Finding</th><th>Rule</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${print ? `<script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script>` : ""}
</body>
</html>`;
}
