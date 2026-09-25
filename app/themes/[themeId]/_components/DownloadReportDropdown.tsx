"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/app/_components/ui/Button";

type FileFormat = "csv" | "xlsx" | "json" | "html" | "pdf";
type Format = FileFormat | "google-sheet";

const FORMAT_LABELS: Record<Format, string> = {
  csv: "CSV",
  xlsx: "XLSX",
  json: "JSON",
  html: "HTML",
  pdf: "PDF (print)",
  "google-sheet": "Google Sheet",
};

/**
 * Replaces the old Report tab's row of per-format export buttons with a
 * single format picker, available from every Theme Detail tab (rendered in
 * the shared page header via TabbedPageClient's titleAction) rather than
 * only from a Report tab. File formats trigger a plain browser download of
 * the same /api/reports/{id}/export endpoint the old buttons used; Google
 * Sheet instead POSTs and shows the resulting link, since that's not a
 * file download.
 */
export function DownloadReportDropdown({ auditRunId, hasExistingSheet }: { auditRunId: string; hasExistingSheet: boolean }) {
  const [format, setFormat] = useState<Format>("csv");
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  function createGoogleSheet() {
    setCreatingSheet(true);
    setSheetError(null);
    setSheetUrl(null);
    fetch(`/api/reports/${auditRunId}/export/google-sheet`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        setCreatingSheet(false);
        if (data.error) setSheetError(data.error);
        else setSheetUrl(data.url);
      })
      .catch(() => {
        setCreatingSheet(false);
        setSheetError("Failed to update the Google Sheet.");
      });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={format}
          onChange={(e) => {
            setFormat(e.target.value as Format);
            setSheetError(null);
            setSheetUrl(null);
          }}
          className="rounded-md border border-border-subtle bg-transparent px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300"
        >
          {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABELS[f]}
            </option>
          ))}
        </select>
        {format === "google-sheet" ? (
          <Button size="sm" onClick={createGoogleSheet} loading={creatingSheet}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            {hasExistingSheet ? "Update Sheet" : "Create Sheet"}
          </Button>
        ) : (
          // A plain anchor, not a button + programmatic navigation — the
          // export endpoint responds with a file attachment, which the
          // browser's own download handling takes care of; matches the
          // pattern the old Report tab's export buttons already used.
          <a
            href={`/api/reports/${auditRunId}/export?format=${format}`}
            // PDF opens a print-ready page in a new tab (Save as PDF from there).
            {...(format === "pdf" ? { target: "_blank", rel: "noreferrer" } : {})}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download
          </a>
        )}
      </div>
      {sheetError && <p className="text-xs text-status-fail-text">{sheetError}</p>}
      {sheetUrl && (
        <a href={sheetUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
          Open sheet
        </a>
      )}
    </div>
  );
}
