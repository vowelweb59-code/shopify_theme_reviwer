"use client";

import { use } from "react";
import Link from "next/link";
import { ReportContent } from "@/app/reports/ReportContent";

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <Link href="/reports" className="text-sm text-zinc-500 underline hover:text-zinc-950 dark:hover:text-zinc-50">
        ← Back to reports
      </Link>
      <ReportContent auditRunId={id} />
    </div>
  );
}
