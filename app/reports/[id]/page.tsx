"use client";

import { use } from "react";
import Link from "next/link";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { ReportContent } from "@/app/reports/ReportContent";

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <PageContainer>
      <Link href="/reports" className="text-sm text-zinc-500 underline hover:text-zinc-950 dark:hover:text-zinc-50">
        ← Back to reports
      </Link>
      <ReportContent auditRunId={id} />
    </PageContainer>
  );
}
