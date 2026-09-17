import type { LucideIcon } from "lucide-react";
import { Inbox, AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-subtle p-10 text-center">
      <Icon className="h-8 w-8 text-zinc-400" aria-hidden />
      <div>
        <p className="font-medium text-zinc-800 dark:text-zinc-200">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  details,
  action,
}: {
  title: string;
  description?: string;
  // Optional raw technical detail (e.g. a caught error message) — never
  // shown by default, only behind an explicit disclosure, matching "avoid
  // exposing raw stack traces to normal users; allow expanding details".
  details?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-status-fail-bg p-5 dark:border-red-900/50">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-fail-icon" aria-hidden />
        <div>
          <p className="font-medium text-status-fail-text">{title}</p>
          {description && <p className="mt-1 text-sm text-status-fail-text">{description}</p>}
        </div>
      </div>
      {details && (
        <details className="w-full pl-8 text-xs text-status-fail-text">
          <summary className="cursor-pointer select-none">Technical details</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{details}</pre>
        </details>
      )}
      {action}
    </div>
  );
}
