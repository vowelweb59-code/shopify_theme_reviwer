import { Suspense } from "react";
import { ProjectDetail } from "../_components/ProjectDetail";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={null}>
      <ProjectDetail projectId={projectId} />
    </Suspense>
  );
}
