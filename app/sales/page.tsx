import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { SalesContent } from "./SalesContent";

export const metadata: Metadata = { title: "Sales · Shopify Theme Auditor" };

export default function SalesPage() {
  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Sales</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Theme sales from your Partner sheets, next to GA4 Try Theme clicks and installs — by theme, preset, category, country and month.
        </p>
      </div>
      <Suspense fallback={null}>
        <SalesContent />
      </Suspense>
    </PageContainer>
  );
}
