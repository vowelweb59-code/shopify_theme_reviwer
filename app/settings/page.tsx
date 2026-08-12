export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Settings</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Submission-readiness thresholds and enabled rule groups land here once the readiness engine
        (Phase 7) and rule engine (Phase 3) exist.
      </p>
    </div>
  );
}
