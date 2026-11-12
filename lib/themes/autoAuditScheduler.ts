import { createRepeatingJob } from "@/lib/jobs/repeatingJob";
import { intervalMs } from "@/lib/jobs/intervalMinutes";
import { runNextAutoAudit } from "./autoAudit";

// Looks for a due theme every 30 minutes and audits one (each theme is due 48 hours after its last audit; see autoAuditPlan.ts).
// The loop waits for the audit to finish before looking again, so themes never run in parallel. On a host that sleeps
// (a free Render instance) audits only happen while it is awake.
const CHECK_MS = intervalMs(process.env.THEME_AUTO_AUDIT_CHECK_MINUTES, 30);

/** Called once from instrumentation.ts on server boot. */
export const startThemeAutoAuditScheduler = createRepeatingJob("theme-auto-audit", "theme-auto-audit", CHECK_MS, async () => {
  const name = await runNextAutoAudit();
  if (name) console.log(`[theme-auto-audit] audited ${name}`);
});
