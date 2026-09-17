import { Suspense } from "react";
import { ThemeDetailTabs } from "./_components/ThemeDetailTabs";

export default async function ThemeDetailPage({ params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = await params;
  return (
    <Suspense fallback={null}>
      <ThemeDetailTabs themeId={themeId} />
    </Suspense>
  );
}
